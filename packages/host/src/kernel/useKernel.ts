import { useContext } from 'react';
import { KernelContext } from '@host/kernel/KernelProvider';
import type { KernelContextValue } from '@ai-image/contracts';

export function useKernel(): KernelContextValue {
  const context = useContext(KernelContext);
  if (!context) {
    throw new Error('useKernel must be used within KernelProvider');
  }
  return context;
}
