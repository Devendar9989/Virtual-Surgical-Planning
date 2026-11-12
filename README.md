# OsseusAI

**OsseusAI** is a production-grade, full-stack web application designed for automated Craniomaxillofacial (CMF) CT segmentation. It provides a clean, modern SaaS-like interface over the powerful [TotalSegmentator](https://github.com/wasserth/TotalSegmentator) deep learning model.

This tool allows clinicians and researchers to upload head CT scans (`.nii.gz`, `.nii`, or DICOM `.zip`) and automatically extract 6 key anatomical structures:
- Skull
- Mandible
- Upper Teeth
- Lower Teeth
- Maxillary Sinus
- Frontal Sinus

---

## 🏗 Architecture & Technologies Used

OsseusAI uses a decoupled frontend-backend architecture to ensure the heavy lifting of deep learning inference doesn't block the UI.

### 1. Frontend (Next.js 15)
- **Framework:** **Next.js 15 (App Router)**. Chosen for its robust server-side rendering, API routes, and clean file-based routing.
- **Language:** **TypeScript**. Enforces strict typing for robust code and fewer runtime errors.
- **Styling:** **Tailwind CSS v4**. Used exclusively for styling. We implemented a unified SaaS design system (navy `#09111F` and sky-blue `#38BDF8` accents) utilizing `@layer utilities` to prevent class purging and keep components clean.
- **Animations:** **Framer Motion**. Drives the smooth page transitions, element reveals (`fadeUp`), and interactive micro-animations (button hovers, dropshadows).
- **State Management:** **Zustand** (for global UI state if needed) and **TanStack React Query** (for asynchronous server state, like checking job status).
- **3D Rendering:** **Three.js / react-three-fiber**. Used to render the interactive skull wireframe canvas on the landing page. Dynamically imported without SSR to prevent hydration crashes.
- **File Upload:** **react-dropzone**. Handles the drag-and-drop interface, file constraints, and validation on the upload page.

### 2. Backend (FastAPI)
- **Framework:** **FastAPI**. A modern, fast web framework for Python. Chosen for its native asynchronous support, which is critical for handling file uploads and long-running job tracking concurrently.
- **Language:** **Python 3.11+**.
- **Inference Execution:** **FastAPI `BackgroundTasks` + `asyncio.to_thread`**. Long-running segmentation jobs are dispatched to a dedicated thread pool, keeping the FastAPI event loop fully responsive.
- **Real-time Communication:** **WebSockets**. The backend streams live progress and status updates back to the frontend via an in-process `ConnectionManager` (no external broker needed).
- **Database:** **SQLite (via `aiosqlite`)**. A lightweight, asynchronous database used to persist job metadata (status, timestamps, output file paths, computed volumes).
- **Segmentation Engine:** **TotalSegmentator**. The core AI engine. Specifically, we execute the `craniofacial_structures` task. It runs entirely locally. *Note: On the very first run, it will automatically download its pre-trained weights (~500MB).*

### 3. Execution Pipeline Flow
1. **Upload:** User drops a CT scan. The Next.js frontend sends it via `XMLHttpRequest` to FastAPI.
2. **Setup:** FastAPI creates a UUID, saves the file to `/data`, creates a database record, and dispatches a background task. Returns the `job_id`.
3. **Processing:** The background thread runs preprocessing, executes `totalsegmentator`, and calculates the volume of the extracted structures.
4. **Updates:** Throughout processing, the worker publishes status updates directly via WebSocket to the Next.js UI.
5. **Results:** The UI displays the segmented NIfTI files, calculated volumes, and allows the user to download them as a ZIP archive.

---

## 🚀 How to Run the Project

Because this project runs locally for privacy and uses a GPU for inference, you need to start the services individually.

### Prerequisites
- **OS:** Linux (Ubuntu recommended)
- **Conda Environment:** `vsp_proj` with PyTorch (CUDA enabled), TotalSegmentator, and FastAPI installed.
- **Node.js:** v20+

### Start the Services
You need **2 separate terminal windows**.

#### Terminal 1: Backend API (FastAPI)
```bash
cd /data1/miccai/vsp_proj_2/backend
conda activate vsp_proj

# Ensure the data directory exists
mkdir -p /data1/miccai/vsp_proj_2/data

# Start the server
DATA_DIR=/data1/miccai/vsp_proj_2/data uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
```

#### Terminal 2: Frontend UI (Next.js)
```bash
cd /data1/miccai/vsp_proj_2/frontend
npm run dev
```

### Access the App
Open your browser and navigate to:
**`http://localhost:3000`**

---

## 🔒 Privacy & Data Handling
- **Local Execution:** No data leaves your machine. The deep learning inference runs locally on your GPU.
- **Storage:** Scans are temporarily saved in `vsp_proj_2/data/uploads` and outputs in `vsp_proj_2/data/outputs`.
- **Auto-Deletion:** The workflow is designed such that data is transient/local. The application includes hooks to delete the job and associated files when commanded.
