import { useState } from 'react';
import type { AuthResponse } from '../api/client';
import { login, register, type User } from '../api/client';

interface Props {
  onAuth: (auth: AuthResponse) => void;
  onError: (error: string) => void;
}

export function LandingPage({ onAuth, onError }: Props) {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form
  const [loginStr, setLoginStr] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [passwordReg, setPasswordReg] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginStr || !password) return;
    setLoading(true);
    setError('');
    try {
      const auth = await login(loginStr, password);
      onAuth(auth);
    } catch (err: any) {
      const errMsg = err.message || 'Ошибка входа';
      setError(errMsg);
      onError(errMsg);
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !email || !passwordReg) return;
    setLoading(true);
    setError('');
    try {
      const auth = await register(username, email, passwordReg, displayName || undefined);
      onAuth(auth);
    } catch (err: any) {
      const errMsg = err.message || 'Ошибка регистрации';
      setError(errMsg);
      onError(errMsg);
      setLoading(false);
    }
  }

  if (showAuth) {
    return (
      <div className="landing-auth-modal">
        <div className="auth-container">
          <button className="close-btn" onClick={() => setShowAuth(false)}>✕</button>

          <div className="auth-tabs">
            <button
              className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setError('');
              }}
            >
              Вход
            </button>
            <button
              className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('register');
                setError('');
              }}
            >
              Регистрация
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="auth-form">
              <h3>Вход в аккаунт</h3>
              <input
                type="text"
                placeholder="Email или username"
                value={loginStr}
                onChange={e => setLoginStr(e.target.value)}
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="btn-primary btn-block" disabled={loading}>
                {loading ? 'Входим...' : 'Войти'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="auth-form">
              <h3>Создать аккаунт</h3>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Отображаемое имя (опционально)"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Пароль"
                value={passwordReg}
                onChange={e => setPasswordReg(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="btn-primary btn-block" disabled={loading}>
                {loading ? 'Создаем...' : 'Создать аккаунт'}
              </button>
            </form>
          )}

          {error && <div className="error-msg" style={{ marginTop: '1rem' }}>
            {error}
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-container">
          <div className="logo-large">GostForge</div>
          <p className="tagline">Экосистема конвертации DOCX ↔ MD ↔ GOST документов</p>
        </div>
      </header>

      {/* Main content */}
      <main className="landing-main">
        <div className="landing-container">
          {/* Hero section */}
          <section className="hero">
            <h1>Универсальная платформа документооборота</h1>
            <p className="hero-subtitle">
              Конвертируйте документы между Markdown, DOCX и ГОСТ форматами.
              Автоматизируйте документооборот для ВУЗов и компаний.
            </p>
            <div className="hero-actions">
              <button
                className="btn-primary btn-lg"
                onClick={() => {
                  setAuthMode('register');
                  setShowAuth(true);
                }}
              >
                Начать бесплатно
              </button>
              <button
                className="btn-secondary btn-lg"
                onClick={() => {
                  setAuthMode('login');
                  setShowAuth(true);
                }}
              >
                Уже есть аккаунт?
              </button>
            </div>
          </section>

          {/* Features */}
          <section className="features">
            <h2>Возможности</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">📝</div>
                <h3>Markdown → DOCX/PDF</h3>
                <p>
                  Конвертируйте Markdown в форматированный DOCX или PDF документ
                  с автоматическим оформлением по ГОСТ стандартам.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🔄</div>
                <h3>DOCX → Markdown</h3>
                <p>
                  Извлекайте структурированный Markdown из DOCX файлов
                  с сохранением форматирования и структуры документа.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🎓</div>
                <h3>ГОСТ Форматирование</h3>
                <p>
                  Автоматическое применение ГОСТ 7.32 для оформления
                  дипломных работ, курсовых и отчетов.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🔌</div>
                <h3>API & Интеграция</h3>
                <p>
                  Personal Access Tokens для интеграции с вашими системами.
                  VS Code Extension для локальной конвертации.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3>Пульс Проекта</h3>
                <p>
                  Открытая статистика конвертаций в реальном времени.
                  Следите за активностью платформы.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">☁️</div>
                <h3>Облачная Обработка</h3>
                <p>
                  Загружайте файлы в облако и получайте результаты.
                  Без установки Python и зависимостей.
                </p>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="how-it-works">
            <h2>Как это работает</h2>
            <div className="steps">
              <div className="step">
                <div className="step-number">1</div>
                <h3>Авторизуйтесь</h3>
                <p>Создайте бесплатный аккаунт или войдите с помощью email и пароля</p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step">
                <div className="step-number">2</div>
                <h3>Выберите формат</h3>
                <p>Markdown → DOCX/PDF или DOCX → Markdown</p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step">
                <div className="step-number">3</div>
                <h3>Загрузите файл</h3>
                <p>Перетащите или выберите файл из компьютера (до 50 MB)</p>
              </div>

              <div className="step-arrow">→</div>

              <div className="step">
                <div className="step-number">4</div>
                <h3>Скачайте результат</h3>
                <p>Получите готовый документ с правильным форматированием</p>
              </div>
            </div>
          </section>

          {/* Use cases */}
          <section className="use-cases">
            <h2>Для кого это</h2>
            <div className="use-cases-grid">
              <div className="use-case">
                <h3>👨‍🎓 Студенты</h3>
                <p>Оформляйте дипломные работы и курсовые по ГОСТ без ручной правки.</p>
              </div>

              <div className="use-case">
                <h3>👨‍🏫 Преподаватели</h3>
                <p>Автоматизируйте проверку и форматирование студенческих работ.</p>
              </div>

              <div className="use-case">
                <h3>🏢 Компании</h3>
                <p>Интегрируйте конвертацию в ваш документооборот через API и расширения.</p>
              </div>

              <div className="use-case">
                <h3>💻 Разработчики</h3>
                <p>REST API, Personal Tokens и VS Code Extension для вашего workflow.</p>
              </div>
            </div>
          </section>

          {/* Tech stack */}
          <section className="tech-stack">
            <h2>Технологический стек</h2>
            <div className="tech-grid">
              <div className="tech-item">
                <span className="tech-badge">Backend</span>
                <p>Java, Spring Boot, Gradle</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">Processing</span>
                <p>Python, python-docx, pypandoc</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">Frontend</span>
                <p>React, TypeScript, Vite</p>
              </div>
              <div className="tech-item">
                <span className="tech-badge">Extension</span>
                <p>VS Code Extension API</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="landing-cta">
            <h2>Начните использовать GostForge прямо сейчас</h2>
            <p>Не требуется установка. Полностью бесплатно для небольших объемов.</p>
            <button
              className="btn-primary btn-lg"
              onClick={() => {
                setAuthMode('register');
                setShowAuth(true);
              }}
            >
              Создать аккаунт
            </button>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <p>&copy; 2026 GostForge. Экосистема документооборота.</p>
          <div className="footer-links">
            <a href="#features">О проекте</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="#contact">Контакты</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
