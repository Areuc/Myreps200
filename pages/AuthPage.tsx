import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { APP_NAME } from '../constants';
import LoadingSpinner from '../components/LoadingSpinner';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // For registration
  const [error, setError] = useState('');
  const [pageLoading, setPageLoading] = useState(false); // Renamed from loading to avoid conflict
  
  const { login, register, loading: authContextLoading } = useAuth(); // Get loading state from context
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPageLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!name.trim()) {
            setError('El nombre es obligatorio para el registro.');
            setPageLoading(false);
            return;
        }
        await register(email, password, name);
      }
      navigate('/'); // Redirect to home on successful auth
    } catch (err: any) {
      setError(err.message || 'Error de autenticación. Verifica tus credenciales.');
    } finally {
        setPageLoading(false);
    }
  };
  
  const commonInputClasses = "mt-1 block w-full px-3 py-2 border border-zinc-600 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-[#06b6d4] focus:border-[#06b6d4] sm:text-sm bg-zinc-700 text-white";

  // Use authContextLoading for disabling button to reflect actual auth operation status
  const isAuthOperationInProgress = pageLoading || authContextLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-[#18181b] to-black px-4 py-12">
      <div className="max-w-md w-full bg-zinc-800 rounded-xl shadow-2xl p-8 space-y-8 border border-zinc-700">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#06b6d4]">{APP_NAME}</h2>
          <p className="mt-2 text-lg text-zinc-400">
            {isLogin ? 'Inicia sesión para continuar' : 'Crea tu cuenta para empezar'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-300">Nombre Completo</label>
              <input
                id="name"
                name="name"
                type="text"
                required={!isLogin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={commonInputClasses}
                placeholder="Tu Nombre"
                disabled={isAuthOperationInProgress}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">Correo Electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={commonInputClasses}
              placeholder="tu@email.com"
              disabled={isAuthOperationInProgress}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={6} // Supabase default min password length
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={commonInputClasses}
              placeholder="••••••••"
              disabled={isAuthOperationInProgress}
            />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-900 bg-opacity-40 p-3 rounded-md">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isAuthOperationInProgress}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-[#06b6d4] hover:bg-[#0891b2] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-800 focus:ring-[#06b6d4] disabled:bg-zinc-600"
            >
              {isAuthOperationInProgress ? <LoadingSpinner size="sm" textColor="text-white"/> : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
            </button>
          </div>
        </form>

        <p className="text-sm text-center text-zinc-400">
          {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="ml-1 font-medium text-[#06b6d4] hover:text-[#0891b2]"
            disabled={isAuthOperationInProgress}
          >
            {isLogin ? 'Regístrate aquí' : 'Inicia sesión aquí'}
          </button>
        </p>
        <p className="text-xs text-zinc-500 text-center mt-6">
            Supabase recomienda un mínimo de 6 caracteres para la contraseña.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;