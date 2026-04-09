import './globals.css';

export const metadata = {
  title: 'WW III - Multiplayer',
  description: 'Post-apocalyptic multiplayer FPS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
