import React, { useEffect, useMemo, useState } from 'react';
import {
  IconBell,
  IconCheck,
  IconClose,
  IconPause,
  IconPlay,
  IconPlus,
  IconRepeat,
  IconRotateCcw,
  IconVolume,
} from '../shared/Icons';
import {
  DEFAULT_TIMERS,
  TIMER_SOUNDS,
  TimerItem,
} from '../shared/types';
import { useChromeStorage } from '../shared/useChromeStorage';
import { useTheme } from '../shared/useTheme';
import {
  formatSeconds,
  playTimerSound,
  stopAlarmSound,
  usePersistWindowBounds,
} from '../shared/windowUtils';

export const TimerWidgetApp: React.FC = () => {
  useTheme();
  usePersistWindowBounds('timer', true);

  const [timers, setTimers] = useChromeStorage<TimerItem[]>(
    'timers',
    DEFAULT_TIMERS
  );
  const [selectedTimerId, setSelectedTimerId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('timerId') || '';
  });
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Boucle d'animation fluide 60 FPS (requestAnimationFrame) pour un cercle parfaitement continu
  useEffect(() => {
    let animFrameId: number;
    const tick = () => {
      setNowMs(Date.now());
      animFrameId = window.requestAnimationFrame(tick);
    };
    animFrameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animFrameId);
  }, []);

  const activeTimer = useMemo(() => {
    return (
      timers.find((t) => t.id === selectedTimerId) ||
      timers.find((t) => t.ringing) ||
      timers.find((t) => t.status === 'running') ||
      timers[0] ||
      null
    );
  }, [timers, selectedTimerId]);

  const exactRemainingMs = useMemo(() => {
    if (!activeTimer) return 0;
    if (activeTimer.status === 'running' && activeTimer.endTime) {
      return Math.max(0, activeTimer.endTime - nowMs);
    }
    return activeTimer.remainingSeconds * 1000;
  }, [activeTimer, nowMs]);

  const liveRemainingSeconds = Math.ceil(exactRemainingMs / 1000);

  // Ratio continu au millième près pour une animation circulaire sans saccades
  const smoothProgressRatio = useMemo(() => {
    if (!activeTimer || activeTimer.durationSeconds <= 0) return 0;
    const totalMs = activeTimer.durationSeconds * 1000;
    return Math.min(1, Math.max(0, exactRemainingMs / totalMs));
  }, [activeTimer, exactRemainingMs]);

  const handleToggle = () => {
    if (!activeTimer) return;
    stopAlarmSound();
    const currentTime = Date.now();
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== activeTimer.id) return t;
        if (t.status === 'running') {
          const left = t.endTime
            ? Math.max(0, Math.ceil((t.endTime - currentTime) / 1000))
            : t.remainingSeconds;
          return {
            ...t,
            status: 'paused',
            remainingSeconds: left,
            endTime: null,
            ringing: false,
          };
        } else {
          const baseSeconds =
            t.status === 'finished' || t.remainingSeconds <= 0
              ? t.durationSeconds
              : t.remainingSeconds;
          return {
            ...t,
            status: 'running',
            remainingSeconds: baseSeconds,
            endTime: currentTime + baseSeconds * 1000,
            ringing: false,
          };
        }
      })
    );
  };

  // Ajouter +1 minute uniquement à la session en cours (sans modifier durationSeconds)
  const handleAddOneMinute = () => {
    if (!activeTimer) return;
    stopAlarmSound();
    const currentTime = Date.now();

    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== activeTimer.id) return t;

        if (t.status === 'running' && t.endTime) {
          const newEndTime = t.endTime + 60_000;
          const newRemaining = Math.ceil((newEndTime - currentTime) / 1000);
          return {
            ...t,
            remainingSeconds: newRemaining,
            endTime: newEndTime,
            ringing: false,
          };
        }

        if (t.status === 'finished') {
          return {
            ...t,
            status: 'running',
            remainingSeconds: 60,
            endTime: currentTime + 60_000,
            ringing: false,
          };
        }

        return {
          ...t,
          remainingSeconds: t.remainingSeconds + 60,
          ringing: false,
        };
      })
    );
  };

  const handleAcknowledgeAlarm = () => {
    if (!activeTimer) return;
    stopAlarmSound();
    setTimers((prev) => {
      if (activeTimer.isTemporary) {
        return prev.filter((t) => t.id !== activeTimer.id);
      }
      return prev.map((t) =>
        t.id === activeTimer.id
          ? {
              ...t,
              status: 'idle',
              remainingSeconds: t.durationSeconds,
              endTime: null,
              ringing: false,
            }
          : t
      );
    });
  };

  const handleReset = () => {
    if (!activeTimer) return;
    stopAlarmSound();
    setTimers((prev) =>
      prev.map((t) =>
        t.id === activeTimer.id
          ? {
              ...t,
              status: 'idle',
              remainingSeconds: t.durationSeconds,
              endTime: null,
              ringing: false,
            }
          : t
      )
    );
  };

  const handleToggleRepeat = () => {
    if (!activeTimer) return;
    setTimers((prev) =>
      prev.map((t) =>
        t.id === activeTimer.id ? { ...t, repeatAlarm: !t.repeatAlarm } : t
      )
    );
  };

  // Paramètres du cercle SVG
  const size = 192;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - smoothProgressRatio);

  const soundInfo = useMemo(() => {
    if (!activeTimer) return TIMER_SOUNDS[0];
    return (
      TIMER_SOUNDS.find((s) => s.id === activeTimer.soundId) || TIMER_SOUNDS[0]
    );
  }, [activeTimer]);

  return (
    <div className="h-screen w-screen flex flex-col bg-md-surface text-md-on-surface overflow-hidden">
      {/* Mini barre de titre personnalisée */}
      <header className="h-10 shrink-0 bg-md-surface-container border-b border-md-outline px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <img
            src="/icons/icon32.png"
            alt="KronoTab"
            className="w-4 h-4 rounded"
          />
          <span className="text-xs font-bold tracking-tight truncate">
            KronoTab Timer
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {timers.length > 1 && activeTimer && (
            <select
              value={activeTimer.id}
              onChange={(e) => setSelectedTimerId(e.target.value)}
              className="bg-md-surface border border-md-outline rounded-full px-2 py-0.5 text-[11px] font-medium text-md-on-surface max-w-[125px] truncate focus:outline-none"
            >
              {timers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => window.close()}
            className="w-6 h-6 rounded-full bg-md-surface hover:bg-rose-500 text-md-on-surface-variant hover:text-white flex items-center justify-center transition-colors"
            title="Fermer le minuteur flottant"
          >
            <IconClose size={13} />
          </button>
        </div>
      </header>

      {/* Corps du minuteur circulaire */}
      {!activeTimer ? (
        <div className="flex-1 flex items-center justify-center p-4 text-xs text-md-on-surface-variant text-center">
          Aucun minuteur disponible. Créez-en un depuis le Side Panel.
        </div>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-between p-4">
          {/* Cadran circulaire SVG continu 60fps */}
          <div className="relative flex items-center justify-center mt-0.5">
            <svg width={size} height={size} className="-rotate-90 transform">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="var(--md-surface-high)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="var(--md-primary)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>

            {/* Contenu central du cercle */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <span className="text-[11px] font-semibold text-md-on-surface-variant truncate max-w-[135px]">
                {activeTimer.label}
              </span>
              <span className="font-mono text-3xl font-bold tracking-tight text-md-on-surface my-1">
                {formatSeconds(liveRemainingSeconds)}
              </span>

              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-md-surface-container text-md-on-surface-variant font-medium">
                  {activeTimer.status === 'running'
                    ? 'En cours'
                    : activeTimer.status === 'paused'
                    ? 'En pause'
                    : activeTimer.status === 'finished'
                    ? 'Terminé !'
                    : `${Math.round(activeTimer.durationSeconds / 60)} min`}
                </span>

                {/* Bouton +1 min directement sur le cadran */}
                <button
                  type="button"
                  onClick={handleAddOneMinute}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-md-primary-container text-md-on-primary-container text-[10px] font-bold hover:opacity-90 transition-opacity"
                  title="Ajouter 1 minute (+1 min)"
                >
                  <IconPlus size={10} />
                  <span>1 min</span>
                </button>
              </div>
            </div>
          </div>

          {/* Si l'alarme sonne ou est terminée : boutons d'acquittement rapides */}
          {activeTimer.status === 'finished' || activeTimer.ringing ? (
            <div className="w-full p-2.5 rounded-2xl bg-md-primary-container text-md-on-primary-container space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                <IconBell size={14} className="animate-bounce" />
                <span>Temps écoulé !</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={handleAcknowledgeAlarm}
                  className="py-1.5 px-2 rounded-full bg-md-primary text-md-on-primary text-[11px] font-bold flex items-center justify-center gap-1"
                >
                  <IconCheck size={12} />
                  <span>D'accord</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddOneMinute}
                  className="py-1.5 px-2 rounded-full bg-md-surface text-md-on-surface text-[11px] font-bold flex items-center justify-center gap-1"
                >
                  <IconPlus size={12} />
                  <span>1 Min</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAcknowledgeAlarm();
                    window.close();
                  }}
                  className="py-1.5 px-2 rounded-full bg-md-surface text-md-on-surface-variant text-[11px] font-semibold flex items-center justify-center gap-1"
                >
                  <IconClose size={12} />
                  <span>Fermer</span>
                </button>
              </div>
            </div>
          ) : (
            /* Contrôles standards */
            <div className="w-full space-y-2">
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggle}
                  className="flex-1 py-2 px-3 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                >
                  {activeTimer.status === 'running' ? (
                    <>
                      <IconPause size={13} />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <IconPlay size={13} />
                      <span>
                        {activeTimer.status === 'paused'
                          ? 'Reprendre'
                          : 'Démarrer'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleAddOneMinute}
                  className="py-2 px-2.5 rounded-full bg-md-surface-container hover:bg-md-surface-high text-md-on-surface text-xs font-bold transition-colors"
                  title="Ajouter 1 minute (+1 min)"
                >
                  +1m
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="p-2 rounded-full bg-md-surface-container hover:bg-md-surface-high text-md-on-surface transition-colors"
                  title="Réinitialiser"
                >
                  <IconRotateCcw size={14} />
                </button>

                <button
                  type="button"
                  onClick={handleToggleRepeat}
                  className={`p-2 rounded-full transition-colors ${
                    activeTimer.repeatAlarm
                      ? 'bg-md-primary-container text-md-on-primary-container'
                      : 'bg-md-surface-container text-md-on-surface-variant'
                  }`}
                  title={
                    activeTimer.repeatAlarm
                      ? 'Alarme en boucle activée'
                      : 'Activer la répétition en boucle de la sonnerie'
                  }
                >
                  <IconRepeat size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => playTimerSound(activeTimer.soundId || 'digital')}
                  className="p-2 rounded-full bg-md-surface-container hover:bg-md-surface-high text-md-on-surface transition-colors"
                  title={`Tester la sonnerie : ${soundInfo.label}`}
                >
                  <IconVolume size={14} />
                </button>
              </div>

              <p className="text-[10px] text-center text-md-on-surface-variant">
                Sonnerie : <span className="font-semibold">{soundInfo.label}</span>{' '}
                {activeTimer.repeatAlarm ? '• En boucle' : ''}
              </p>
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default TimerWidgetApp;
