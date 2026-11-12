'use client';

import React, { useEffect, useRef, useState } from 'react';

export const NiftiViewer = ({ url }: { url: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'initializing' | 'loading' | 'ready' | 'error'>('initializing');

  useEffect(() => {
    let nv: any = null;

    const initViewer = async () => {
      try {
        // Dynamic import inside effect ensures browser-only execution
        const { Niivue } = await import('@niivue/niivue');
        
        if (!canvasRef.current) return;

        setStatus('loading');

        nv = new Niivue({
          backColor: [0.1, 0.1, 0.1, 1],
          show3Dcrosshair: true,
          loadingText: 'Loading NIfTI...',
        });
        
        nv.attachToCanvas(canvasRef.current);
        
        const volumeList = [
          {
            url: url,
            name: 'volume.nii.gz', 
            colorMap: 'blue', // Vibrant color for masks
            opacity: 1,
            visible: true,
            cal_min: 0,
            cal_max: 1,
            trustCalMinMax: true, // Force Niivue to use 0-1 range
          }
        ];
        
        await nv.loadVolumes(volumeList);
        setStatus('ready');
      } catch (err) {
        console.error('Niivue Error:', err);
        setStatus('error');
      }
    };

    initViewer();

    return () => {
      if (nv) {
        nv.destroy?.();
      }
    };
  }, [url]);

  return (
    <div className="relative w-full h-[500px] border border-gray-700 bg-[#060912] rounded-lg overflow-hidden group">
      {/* Background Grid */}
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      
      {/* Loading/Error Overlays */}
      {status !== 'ready' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060912]/80 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-4" />
          <div className="text-sky-400 font-mono text-xs tracking-widest uppercase">
            {status === 'initializing' ? 'Initializing 3D Engine...' : 
             status === 'loading' ? 'Fetching Volume Data...' : 
             'Error Loading Viewer'}
          </div>
        </div>
      )}

      {/* Viewer Canvas */}
      <canvas ref={canvasRef} className="w-full h-full outline-none relative z-10" />

      {/* Interactions Overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-[10px] text-slate-300 font-medium whitespace-nowrap">
          Rotate: Drag • Zoom: Scroll • Pan: Shift + Drag
        </span>
      </div>
    </div>
  );
};
