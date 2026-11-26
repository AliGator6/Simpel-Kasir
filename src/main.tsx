import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function renderEmergencyRecovery(reason?: string) {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  if (rootEl.childElementCount > 0) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#F5F6F4;color:#17252B;font-family:sans-serif;text-align:center;';

  const card = document.createElement('div');
  card.style.cssText =
    'max-width:360px;width:100%;background:#FFFFFF;border-radius:20px;padding:24px;box-shadow:0 12px 30px rgba(0,0,0,0.08);border:1px solid #DCE3DD;';

  const title = document.createElement('h2');
  title.textContent = 'Memulihkan Tampilan Aplikasi';
  title.style.cssText = 'margin:0 0 8px;font-size:18px;font-weight:700;color:#165B49;';

  const desc = document.createElement('p');
  desc.textContent =
    'Data produk dan transaksi Anda tetap aman tersimpan. Ketuk tombol di bawah untuk memuat ulang tampilan.';
  desc.style.cssText = 'margin:0 0 16px;font-size:13px;line-height:1.5;color:#475569;';

  const btn = document.createElement('button');
  btn.textContent = 'Muat Ulang SimpelKasir';
  btn.style.cssText =
    'width:100%;min-height:46px;border:none;border-radius:12px;background:#165B49;color:#FFFFFF;font-size:14px;font-weight:700;cursor:pointer;';
  btn.onclick = () => window.location.reload();

  card.appendChild(title);
  card.appendChild(desc);
  if (reason) {
    const info = document.createElement('p');
    info.textContent = reason;
    info.style.cssText =
      'margin:0 0 14px;font-size:11px;color:#64748B;background:#F1F5F9;padding:8px;border-radius:8px;word-break:break-word;';
    card.appendChild(info);
  }
  card.appendChild(btn);
  wrapper.appendChild(card);
  rootEl.appendChild(wrapper);
}

window.addEventListener('error', (event) => {
  const rootEl = document.getElementById('root');
  if (rootEl && rootEl.childElementCount === 0) {
    renderEmergencyRecovery(event.message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  // Prevent silent crash propagation on Android WebView
  event.preventDefault();
});

try {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    createRoot(rootEl).render(<App />);
  }
} catch (err) {
  renderEmergencyRecovery((err as Error)?.message);
}
