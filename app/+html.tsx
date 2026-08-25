import { ScrollViewStyleReset } from 'expo-router/html';
import { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="#0E563A" name="theme-color" />
        <meta content="Panel comercial móvil de Parque del Recuerdo" name="description" />
        <title>PDR Comercial</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
