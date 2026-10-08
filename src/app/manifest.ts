import type { MetadataRoute } from "next";

/**
 * Permite instalar la app en el telefono ("Agregar a pantalla de inicio") con
 * su icono y sin la barra del navegador, que es como se usa en obra.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reportes de obra — Proyecto Chilama",
    short_name: "Chilama",
    description:
      "Reportes de campo y estatus consolidado de la supervisión del proyecto Chilama.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#123863",
    lang: "es",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android recorta el icono con su propia forma: esta version va a sangre
      // y deja el dibujo dentro de la zona segura.
      {
        src: "/icono-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
