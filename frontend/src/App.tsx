import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { MobileHeader } from './components/layout/MobileHeader';
import { HomePage } from './pages/HomePage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { useMobileNav } from './hooks/useMobileNav';
import { useTheme } from './hooks/useTheme';

function App() {
  const nav = useMobileNav();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <ErrorBoundary>
    <ToastProvider>
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-surface">
        {/* Desktop sidebar */}
        {!nav.isMobile && <Sidebar onNavigate={nav.close} theme={theme} onToggleTheme={toggleTheme} />}

        {/* Mobile overlay */}
        {nav.isMobile && nav.isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={nav.close}
          />
        )}

        {/* Mobile drawer */}
        {nav.isMobile && (
          <aside
            className={`
              fixed inset-y-0 left-0 z-50 w-[280px]
              transition-transform duration-300 ease-[var(--ease-out-expo)]
              ${nav.isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
          >
            <Sidebar onNavigate={nav.close} theme={theme} onToggleTheme={toggleTheme} />
          </aside>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {nav.isMobile && <MobileHeader onMenuClick={nav.toggle} />}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/kb/:kbId" element={<KnowledgeBasePage />} />
            <Route
              path="/kb/:kbId/chat/:conversationId"
              element={<KnowledgeBasePage />}
            />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
    </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
