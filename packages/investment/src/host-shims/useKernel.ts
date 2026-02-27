interface InvestmentKernel {
  os: {
    notify: (message: string) => void;
  };
}

const standaloneKernel: InvestmentKernel = {
  os: {
    notify: (message: string) => {
      if (typeof window !== 'undefined') {
        window.console.info('[investment-standalone]', message);
      }
    }
  }
};

export function useKernel(): InvestmentKernel {
  return standaloneKernel;
}
