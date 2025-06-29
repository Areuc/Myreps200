

import React, { useState, useTransition } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { APP_NAME } from '../constants';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth(); // user is the Profile object
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error("Logout failed:", error);
      // Optionally show an error message to the user
    }
  };

  const handleMobileLinkClick = () => {
    startTransition(() => {
      setIsMobileMenuOpen(false);
    });
  };
  
  const handleMobileLogout = () => {
      handleLogout();
      handleMobileLinkClick();
  };


  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive ? 'bg-[#06b6d4] text-white' : 'text-zinc-300 hover:bg-zinc-700 hover:text-[#06b6d4]'
    }`;

  const mobileNavLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-md text-base font-medium ${
      isActive ? 'bg-[#06b6d4] text-white' : 'text-zinc-300 hover:bg-zinc-700 hover:text-[#06b6d4]'
    }`;

  return (
    <nav className="bg-zinc-950 shadow-lg border-b border-zinc-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <NavLink to="/" className="text-[#06b6d4] font-bold text-xl">
              {APP_NAME}
            </NavLink>
          </div>
          {user && ( // Check if user (Profile object) exists
            <>
              {/* Desktop Menu */}
              <div className="hidden md:flex items-center space-x-4">
                <NavLink to="/" className={navLinkClasses}>Inicio</NavLink>
                <NavLink to="/exercises" className={navLinkClasses}>Ejercicios</NavLink>
                <NavLink to="/routines" className={navLinkClasses}>Rutinas</NavLink>
                <NavLink to="/progress" className={navLinkClasses}>Progreso</NavLink>
                <NavLink to="/profile" className={navLinkClasses}>Perfil</NavLink>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-md text-sm font-medium text-zinc-300 hover:bg-red-600 hover:text-white transition-colors"
                >
                  Cerrar Sesión
                </button>
              </div>

              {/* Mobile Menu Button */}
              <div className="md:hidden flex items-center">
                <button
                  onClick={() => setIsMobileMenuOpen(prev => !prev)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  aria-controls="mobile-menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  <span className="sr-only">Abrir menú principal</span>
                  {isMobileMenuOpen ? (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu, show/hide based on menu state using CSS classes */}
      <div
        id="mobile-menu"
        className={`md:hidden ${isMobileMenuOpen && user ? 'block' : 'hidden'}`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <NavLink to="/" className={mobileNavLinkClasses} onClick={handleMobileLinkClick}>Inicio</NavLink>
          <NavLink to="/exercises" className={mobileNavLinkClasses} onClick={handleMobileLinkClick}>Ejercicios</NavLink>
          <NavLink to="/routines" className={mobileNavLinkClasses} onClick={handleMobileLinkClick}>Rutinas</NavLink>
          <NavLink to="/progress" className={mobileNavLinkClasses} onClick={handleMobileLinkClick}>Progreso</NavLink>
          <NavLink to="/profile" className={mobileNavLinkClasses} onClick={handleMobileLinkClick}>Perfil</NavLink>
          <button
            onClick={handleMobileLogout}
            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-zinc-300 hover:bg-red-600 hover:text-white"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;