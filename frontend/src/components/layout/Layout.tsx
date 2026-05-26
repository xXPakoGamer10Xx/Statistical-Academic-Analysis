import { useState, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  BarChart3,
  GraduationCap,
  UserCheck,
  Upload,
  BookOpen,
  LogOut,
  Menu,
  X,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  directivo: "Directivo",
  admin: "Administrador",
  usuario: "Usuario",
};

const NAV_ITEMS = [
  { to: "/", label: "Resumen General", icon: BarChart3, allowedRoles: null },
  { to: "/matricula", label: "Matrícula", icon: Users, allowedRoles: null },
  { to: "/rendimiento", label: "Rendimiento", icon: BookOpen, allowedRoles: null },
  { to: "/eficiencia", label: "Eficiencia", icon: GraduationCap, allowedRoles: null },
  { to: "/docentes", label: "Eval. Docente", icon: UserCheck, allowedRoles: null },
  { to: "/cargas", label: "Cargas", icon: Upload, allowedRoles: ["admin"] },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users, allowedRoles: ["admin", "directivo"] },
  { to: "/admin/auditoria", label: "Auditoría", icon: ClipboardList, allowedRoles: ["directivo"] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const userRole = user?.role ?? "usuario";

  const mainRef = useRef<HTMLDivElement>(null);
  const [isVisibleTop, setIsVisibleTop] = useState(true);
  const [isVisibleBottom, setIsVisibleBottom] = useState(false);
  const lastScrollY = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentScrollY = target.scrollTop;
    
    // Bounds
    const isAtTop = currentScrollY < 20;
    const bottomDistance = target.scrollHeight - currentScrollY - target.clientHeight;
    const isAtBottom = bottomDistance < 20;
    
    // Direction
    const isScrollingUp = currentScrollY < lastScrollY.current;
    
    if (isAtTop || (isScrollingUp && !isAtBottom)) {
      setIsVisibleTop(true);
      setIsVisibleBottom(false);
    } else if (isAtBottom) {
      setIsVisibleTop(false);
      setIsVisibleBottom(true);
    } else {
      // scrolling down but not at bottom
      setIsVisibleTop(false);
      setIsVisibleBottom(false);
    }
    
    lastScrollY.current = currentScrollY;
  };

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const MobileMenu = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="border-b border-white/5 p-6 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">Análisis Stats</h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Dirección Académica</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.filter((i) => !i.allowedRoles || i.allowedRoles.includes(userRole)).map((item) => {
          const isActive = item.to === "/" 
            ? location.pathname === "/" 
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                isActive
                  ? "bg-brand-600 text-white font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-white/5 p-4 shrink-0">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.aside 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 flex-col bg-slate-900 text-white flex md:hidden"
          >
            <MobileMenu />
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="md:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 px-4 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white uppercase">Análisis Stats</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {[{ display: true, key: 'top', yHidden: -100, posClass: 'top-4', isVisible: isVisibleTop }, { display: true, key: 'bottom', yHidden: 100, posClass: 'bottom-4', isVisible: isVisibleBottom }].map((dock) => (
        <motion.div 
          key={dock.key}
          initial={false}
          animate={{ y: dock.isVisible ? 0 : dock.yHidden, opacity: dock.isVisible ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn("hidden md:flex fixed left-0 right-0 z-50 justify-center pointer-events-none", dock.posClass)}
        >
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] pointer-events-auto">
            <NavLink
               to="/"
               end
               className={cn(
                 "mr-1 ml-1 flex items-center justify-center relative group isolate h-10 w-10 rounded-xl transition-all duration-200 hover:scale-110",
                 dock.key === 'top' ? "hover:-translate-y-1 align-bottom" : "hover:translate-y-1 align-top"
               )}
               onMouseEnter={() => setHoveredItem(`logo-${dock.key}`)}
               onMouseLeave={() => setHoveredItem(null)}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shadow-md text-white transition-all",
                    isActive 
                      ? "bg-gradient-to-br from-brand-500 to-brand-600 shadow-brand-500/20" 
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  )}>
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  {isActive && (
                    <div className={cn("absolute w-1 h-1 rounded-full bg-brand-500 z-10", dock.key === 'top' ? "-bottom-1" : "-top-1")} />
                  )}
                  <AnimatePresence>
                    {hoveredItem === `logo-${dock.key}` && (
                      <motion.div
                        initial={{ opacity: 0, y: dock.key === 'top' ? 10 : -10, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: dock.key === 'top' ? 5 : -5, scale: 0.9 }}
                        className={cn("absolute px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-50", dock.key === 'top' ? "top-full mt-3" : "bottom-full mb-3")}
                      >
                        Resumen General
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </NavLink>

            <div className="w-px h-8 bg-slate-300 dark:bg-slate-700 mx-1" />

            {NAV_ITEMS.filter((i) => i.to !== "/" && (!i.allowedRoles || i.allowedRoles.includes(userRole))).map((item) => {
              const isActive = item.to === "/" 
                ? location.pathname === "/" 
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onMouseEnter={() => setHoveredItem(`${item.to}-${dock.key}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={cn(
                    "relative flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200 group isolate",
                    isActive
                      ? "bg-slate-200 dark:bg-slate-800 text-brand-600 dark:text-brand-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white",
                    "hover:scale-110", dock.key === 'top' ? "hover:-translate-y-1 align-bottom" : "hover:translate-y-1 align-top"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  
                  {isActive && (
                    <div className={cn("absolute w-1 h-1 rounded-full bg-brand-500", dock.key === 'top' ? "-bottom-1" : "-top-1")} />
                  )}

                  <AnimatePresence>
                    {hoveredItem === `${item.to}-${dock.key}` && (
                      <motion.div
                        initial={{ opacity: 0, y: dock.key === 'top' ? 10 : -10, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: dock.key === 'top' ? 5 : -5, scale: 0.9 }}
                        className={cn("absolute px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-50", dock.key === 'top' ? "top-full mt-3" : "bottom-full mb-3")}
                      >
                        {item.label}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </NavLink>
              );
            })}

            <div className="w-px h-8 bg-slate-300 dark:bg-slate-700 mx-1" />

            <div className="flex items-center gap-2 ml-1">
              <button
                onMouseEnter={() => setHoveredItem(`profile-${dock.key}`)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn("relative flex items-center justify-center h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-all hover:scale-110 isolate", dock.key === 'top' ? "hover:-translate-y-1" : "hover:translate-y-1")}
              >
                {user?.full_name?.charAt(0).toUpperCase() || "U"}
                
                <AnimatePresence>
                  {hoveredItem === `profile-${dock.key}` && (
                    <motion.div
                      initial={{ opacity: 0, y: dock.key === 'top' ? 10 : -10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: dock.key === 'top' ? 5 : -5, scale: 0.9 }}
                      className={cn("absolute px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg whitespace-nowrap", dock.key === 'top' ? "top-full mt-3" : "bottom-full mb-3")}
                    >
                      {user?.full_name} · {ROLE_LABELS[userRole] ?? userRole}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              <button
                onClick={onLogout}
                onMouseEnter={() => setHoveredItem(`logout-${dock.key}`)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn("relative flex items-center justify-center h-10 w-10 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-all hover:scale-110 isolate", dock.key === 'top' ? "hover:-translate-y-1" : "hover:translate-y-1")}
              >
                <LogOut className="h-5 w-5" />
                
                <AnimatePresence>
                  {hoveredItem === `logout-${dock.key}` && (
                    <motion.div
                      initial={{ opacity: 0, y: dock.key === 'top' ? 10 : -10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: dock.key === 'top' ? 5 : -5, scale: 0.9 }}
                      className={cn("absolute px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg whitespace-nowrap", dock.key === 'top' ? "top-full mt-3" : "bottom-full mb-3")}
                    >
                      Cerrar sesión
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </motion.div>
      ))}

      <main 
        ref={mainRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col md:pt-24 md:pb-24 mt-0"
      >
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto w-full max-w-[2000px] p-4 md:p-6 lg:p-8"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
