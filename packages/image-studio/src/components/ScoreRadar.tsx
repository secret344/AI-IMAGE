import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import type { EvaluationDimension } from '@/types/evaluation';

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface ScoreRadarProps {
  dimensions: EvaluationDimension[];
}

export function ScoreRadar({ dimensions }: ScoreRadarProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // 获取计算的样式以支持主题
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryColor = computedStyle.getPropertyValue('--primary').trim() || '59 130 246';
    const mutedColor = computedStyle.getPropertyValue('--muted-foreground').trim() || '148 163 184';
    const borderColor = computedStyle.getPropertyValue('--border').trim() || '229 231 235';

    const chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: dimensions.map((dimension) => t(`dimensions.${dimension.name.toLowerCase()}`)),
        datasets: [
          {
            label: t('result.scoreRadar'),
            data: dimensions.map((dimension) => dimension.score),
            backgroundColor: `rgba(${primaryColor}, 0.15)`,
            borderColor: `rgb(${primaryColor})`,
            pointBackgroundColor: `rgb(${primaryColor})`,
            pointBorderColor: '#fff',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: `rgb(${mutedColor})`,
              font: { size: 11, weight: 'bold' }
            },
            grid: { color: `rgba(${borderColor}, 0.3)` },
            angleLines: { color: `rgba(${borderColor}, 0.2)` },
            pointLabels: {
              color: 'currentColor',
              font: { size: 12, weight: 'bold' },
              padding: 8
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 8,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.r}/100`
            }
          }
        }
      }
    });

    return () => {
      chart.destroy();
    };
  }, [dimensions, t]);

  return (
    <div className="w-full h-72 flex items-center justify-center bg-card/30 rounded-lg p-4">
      <canvas ref={canvasRef} />
    </div>
  );
}
