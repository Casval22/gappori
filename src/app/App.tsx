import { HashRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { useApp } from './store'
import { Play } from '../features/play/Play'
import { PatternList } from '../features/patterns/PatternList'
import { Settings } from '../features/settings/Settings'
import { History } from '../features/history/History'
export function App() {
  const { demo, warning, setDemo } = useApp()
  return (
    <HashRouter>
      <a className="skip-link" href="#main-content">
        本文へ
      </a>
      <header className="app-header">
        <NavLink to="/" className="brand">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            がっぽり<span className="brand-light">ナビ</span>
            <small>1台で、みんなのプレイを。</small>
          </span>
        </NavLink>
        <NavLink className="header-settings" to="/settings">
          設定 ↗
        </NavLink>
      </header>
      {demo && (
        <div className="demo-banner" role="status">
          架空配当のデモ · 実機の配当ではありません{' '}
          <button onClick={() => setDemo(false)}>終了</button>
        </div>
      )}
      {warning && (
        <div className="storage-warning" role="alert">
          {warning}
        </div>
      )}
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Play />} />
          <Route path="/patterns" element={<PatternList manage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer">
        非公式プレイ支援ツール · 配当・利益を保証しません。
        <br />
        データはこのブラウザ内だけに保存されます。
      </footer>
      <nav className="bottom-nav" aria-label="メインメニュー">
        {[
          ['/', '01', 'プレイ'],
          ['/patterns', '02', '型の管理'],
          ['/settings', '03', '設定'],
          ['/history', '04', '履歴・データ'],
        ].map(([to, icon, title]) => (
          <NavLink key={to} to={to} end>
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>
    </HashRouter>
  )
}
