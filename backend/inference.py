import os
import sys
import json
import logging
from pathlib import Path
import sqlite3
import datetime
from dotenv import load_dotenv

import sys
import types
try:
    from nnunetv2.training.dataloading.base_data_loader import nnUNetDataLoaderBase
except ImportError:
    nnUNetDataLoaderBase = object

# Hotfix for nnU-Net v2.4+ loading older TotalSegmentator checkpoints which pickle old module paths
for mod_name in [
    'nnunetv2.training.dataloading.data_loader'
]:
    if mod_name not in sys.modules:
        m = types.ModuleType(mod_name)
        if mod_name == 'nnunetv2.training.dataloading.data_loader':
            m.nnUNetDataLoader = nnUNetDataLoaderBase
        sys.modules[mod_name] = m

# Load .env file explicitly
load_dotenv()

# Set up logging
logger = logging.getLogger("osseus.inference")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("[%(asctime)s] INFERENCE - %(levelname)s - %(message)s"))
    logger.addHandler(handler)

DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent.parent / "data")))
DB_PATH = DATA_DIR / "osseus.db"

STRUCTURE_LABEL_MAP = {
    "skull": {"labels": list(range(1, 9)), "display": "Skull"},
    "mandible": {"labels": [9], "display": "Mandible"},
    "teeth_upper": {"labels": [10, 11], "display": "Upper Teeth"},
    "teeth_lower": {"labels": [12, 13], "display": "Lower Teeth"},
    "sinus_maxillary": {"labels": [14, 15], "display": "Maxillary Sinus"},
    "sinus_frontal": {"labels": [16], "display": "Frontal Sinus"},
}

STRUCTURE_FILES = {
    "skull": ["skull.nii.gz"],
    "mandible": ["mandible.nii.gz"],
    "teeth_upper": ["teeth_upper.nii.gz"],
    "teeth_lower": ["teeth_lower.nii.gz"],
    "sinus_maxillary": ["sinus_maxillary.nii.gz"],
    "sinus_frontal": ["sinus_frontal.nii.gz"],
}

def _db_update(job_id: str, **kwargs):
    conn = sqlite3.connect(str(DB_PATH))
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    conn.execute(f"UPDATE jobs SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()

def _compute_volume(nii_path: Path, voxel_volume_ml: float) -> tuple[int, float]:
    import nibabel as nib
    import numpy as np
    img = nib.load(str(nii_path))
    data = img.get_fdata()
    voxels = int(np.sum(data > 0))
    vol = voxels * voxel_volume_ml / 1000.0
    return voxels, round(vol, 2)

def run_segmentation_sync(job_id: str, fast: bool = False):
    """
    Synchronous blocking function that runs the heavy deep learning inference.
    Should be called via asyncio.to_thread / run_in_executor to avoid blocking FastAPI.
    """
    logger.info(f"--- task started for job: {job_id} ---")
    
    # Needs to dynamically import ws at runtime to avoid circular imports 
    # since inference is run from main.py which imports ws
    from ws import publish_progress

    def _publish(status: str, progress: int, step: str, log_line: str = ""):
        logger.info(f"Job {job_id} | Status: {status} | Progress: {progress}% | Step: {step}")
        try:
            # We must use asyncio.run because publish_progress is async
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(publish_progress(job_id, status, progress, step, log_line))
                else:
                    asyncio.run(publish_progress(job_id, status, progress, step, log_line))
            except RuntimeError:
                asyncio.run(publish_progress(job_id, status, progress, step, log_line))
        except Exception as e:
            logger.warning(f"Failed to publish progress to websocket: {e}")
        _db_update(job_id, status=status, progress=progress, step=step)


    input_dir = DATA_DIR / "uploads" / job_id
    output_dir = DATA_DIR / "outputs" / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    input_file = next(input_dir.glob("*.nii*"), None) or next(input_dir.glob("*.zip"), None)
    if input_file is None:
        logger.error(f"Job {job_id}: Input file not found in {input_dir}")
        _db_update(job_id, status="failed", error="Input file not found")
        return

    logger.info(f"Job {job_id}: Found input file {input_file.name}")
    _publish("processing", 5, "Loading scan")

    try:
        logger.info(f"Job {job_id}: Importing nibabel and numpy...")
        import nibabel as nib
        import numpy as np

        _publish("processing", 15, "Preprocessing")
        
        # This import is extremely fast now if it was already imported during FastAPI lifespan!
        logger.info(f"Job {job_id}: Requesting explicit totalsegmentator API...")
        from totalsegmentator.python_api import totalsegmentator

        _publish("processing", 20, "Running TotalSegmentator")
        
        logger.info(f"Job {job_id}: Starting inference. Output will go to {output_dir}")
        
        # Native Deep Learning execution
        totalsegmentator(
            input=str(input_file),
            output=str(output_dir),
            task="craniofacial_structures",
            fast=False, # Task 'craniofacial_structures' does not support fast mode
            quiet=False,
        )
        logger.info(f"Job {job_id}: Inference complete.")

        _publish("processing", 80, "Computing volumes")
        
        logger.info(f"Job {job_id}: Loading reference image for volume calculation")
        img = nib.load(str(input_file))
        zooms = img.header.get_zooms()
        voxel_vol_ml = float(zooms[0] * zooms[1] * zooms[2]) / 1000.0

        results = []
        for key, files in STRUCTURE_FILES.items():
            total_voxels = 0
            total_vol = 0.0
            for fname in files:
                fpath = output_dir / fname
                if fpath.exists():
                    v, cm3 = _compute_volume(fpath, voxel_vol_ml * 1000)
                    total_voxels += v
                    total_vol += cm3
            
            if total_voxels > 0:
                logger.info(f"Job {job_id}: Found structure '{key}' with {total_voxels} voxels ({total_vol} cm3)")
                file_url = f"/api/job/{job_id}/download/{key}"
                results.append({
                    "name": key,
                    "display": STRUCTURE_LABEL_MAP[key]["display"],
                    "file_url": file_url,
                    "voxel_count": total_voxels,
                    "volume_cm3": round(total_vol, 2),
                })

        _publish("processing", 95, "Finalizing outputs")
        
        logger.info(f"Job {job_id}: Saving final results to DB")
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute(
            "UPDATE jobs SET status='completed', progress=100, step='Done', completed_at=?, results_json=? WHERE id=?",
            (datetime.datetime.utcnow().isoformat(), json.dumps(results), job_id),
        )
        conn.commit()
        conn.close()

        _publish("completed", 100, "Done")
        logger.info(f"--- task finished for job: {job_id} ---")

    except Exception as e:
        import traceback
        err = traceback.format_exc()
        logger.error(f"Job {job_id} failed with exception:\n{err}")
        _db_update(job_id, status="failed", error=str(e)[:500])
        _publish("failed", 0, "Failed", str(e)[:200])
        raise
