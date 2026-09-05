import { Check, Clock, AlertCircle } from 'lucide-react';

const STEP_LABELS = {
  processing: 'Processing',
  warehouse_assigned: 'Warehouse',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export default function StatusTracker({ steps, currentStep, labels, stepStates }) {
  const stepList = steps || Object.keys(STEP_LABELS);
  const stepLabels = labels || STEP_LABELS;

  return (
    <div className="status-tracker w-full py-4">
      <div className="flex items-center w-full">
        {stepList.map((step, idx) => {
          const explicitState = stepStates ? stepStates[step] : null;
          const isDone = explicitState ? explicitState === 'done' : idx < currentStep;
          const isActive = explicitState ? explicitState === 'active' : idx === currentStep;
          const isRejected = explicitState === 'rejected';

          const labelText = typeof stepLabels === 'function'
            ? stepLabels(step, { isDone, isActive, isRejected, idx })
            : (typeof stepLabels[step] === 'function' ? stepLabels[step]({ isDone, isActive, isRejected }) : stepLabels[step] || step);

          return (
            <div key={step} className="flex-1 flex items-center">
              <div className="flex flex-col items-center relative text-center shrink-0 mx-auto">
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 font-bold ${
                    isDone 
                      ? 'bg-[#047857] text-white shadow-sm' 
                      : isRejected
                        ? 'bg-[#be123c] text-white shadow-sm'
                        : isActive
                          ? 'bg-[#0e7490] text-white ring-4 ring-[#0e7490]/20 shadow-md'
                          : 'bg-[#edf0f4] text-[#7b8ca0] border border-[#0d1b2a]/[0.1]'
                  }`}
                >
                  {isDone ? (
                    <Check size={16} strokeWidth={2.8} />
                  ) : isRejected ? (
                    <AlertCircle size={16} strokeWidth={2.5} />
                  ) : isActive ? (
                    <Clock size={16} strokeWidth={2.5} />
                  ) : (
                    <span className="text-xs">{idx + 1}</span>
                  )}
                </div>

                <div 
                  className={`mt-2 font-mono text-[10px] sm:text-[11px] font-bold tracking-wider uppercase whitespace-nowrap ${
                    isDone 
                      ? 'text-[#047857]' 
                      : isRejected
                        ? 'text-[#be123c]'
                        : isActive
                          ? 'text-[#0e7490]'
                          : 'text-[#7b8ca0]'
                  }`}
                >
                  {labelText}
                </div>
              </div>

              {idx < stepList.length - 1 && (
                <div 
                  className={`h-[2.5px] flex-1 mx-2 -mt-5 rounded-full transition-all duration-500 ${
                    isDone ? 'bg-[#047857]' : 'bg-[#edf0f4]'
                  }`} 
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
