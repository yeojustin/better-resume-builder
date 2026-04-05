import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export function OriginalResumePdf({ dataUrl }: { dataUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const pageWidth = typeof window !== 'undefined' ? Math.min(400, Math.floor(window.innerWidth * 0.36)) : 360;

  return (
    <div className="flex flex-col items-center">
      {err ? <p className="mb-2 max-w-xs text-center text-xs text-red-600">{err}</p> : null}
      <Document
        file={dataUrl}
        onLoadSuccess={({ numPages: n }) => {
          setErr(null);
          setNumPages(n);
        }}
        onLoadError={(e) => setErr(e.message || 'Failed to load PDF')}
        loading={<p className="text-xs text-[#6b7280]">Loading PDF…</p>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i + 1} className="mb-6 flex flex-col items-center border-b border-[#e5e7eb] pb-6 last:mb-0 last:border-0">
            <Page
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer
              renderAnnotationLayer
            />
            <p className="mt-2 text-[10px] text-[#9ca3af]">
              Original file · Page {i + 1} of {numPages}
            </p>
          </div>
        ))}
      </Document>
    </div>
  );
}
