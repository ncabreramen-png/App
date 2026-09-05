/* eslint-disable @next/next/no-img-element */

export default function GaleriaFotos({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((url, i) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-slate-200"
        >
          <img
            src={url}
            alt={`Foto ${i + 1} del reporte`}
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}
