const STEP_ICONS = {
  processing: '⚙️',
  warehouse_assigned: '🏭',
  shipped: '🚚',
  delivered: '✅',
};

const STEP_LABELS = {
  processing: 'Processing',
  warehouse_assigned: 'Warehouse',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export default function StatusTracker({ steps, currentStep, labels, icons, stepStates }) {
  const stepList = steps || Object.keys(STEP_LABELS);
  const stepIcons = icons || STEP_ICONS;
  const stepLabels = labels || STEP_LABELS;

  return (
    <div className="status-tracker">
      <div className="tracker-steps">
        {stepList.map((step, idx) => {
          // Allow explicit override per step if stepStates is passed
          const explicitState = stepStates ? stepStates[step] : null;
          const isDone = explicitState ? explicitState === 'done' : idx < currentStep;
          const isActive = explicitState ? explicitState === 'active' : idx === currentStep;
          const isRejected = explicitState === 'rejected';

          const labelText = typeof stepLabels === 'function'
            ? stepLabels(step, { isDone, isActive, isRejected, idx })
            : (typeof stepLabels[step] === 'function' ? stepLabels[step]({ isDone, isActive, isRejected }) : stepLabels[step] || step);

          let symbol = '○';
          if (isDone) {
            symbol = '✓';
          } else if (isRejected) {
            symbol = '✕';
          } else if (isActive) {
            symbol = '●';
          } else if (stepIcons[step]) {
            symbol = stepIcons[step];
          }

          const dotClass = [
            'tracker-dot',
            isDone ? 'done' : '',
            isActive ? 'active' : '',
            isRejected ? 'rejected' : '',
          ].filter(Boolean).join(' ');

          const labelClass = [
            'tracker-step-label',
            isDone ? 'done' : '',
            isActive ? 'active' : '',
            isRejected ? 'rejected' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div className="tracker-step">
                <div className={dotClass}>
                  {symbol}
                </div>
                <div className={labelClass}>
                  {labelText}
                </div>
              </div>
              {idx < stepList.length - 1 && (
                <div className={`tracker-connector ${isDone ? 'done' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

