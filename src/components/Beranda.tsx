import React from 'react';
import { ActivityMonitor } from './ActivityMonitor';

/**
 * Beranda Component - Rekapitulasi Aktivitas Real-Time
 * Wraps ActivityMonitor with instant WebSocket listener and reactive state
 */
export const Beranda = ActivityMonitor;
export default ActivityMonitor;
