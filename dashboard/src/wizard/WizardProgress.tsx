import './WizardProgress.css';

interface WizardProgressProps {
  steps: string[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="wizard-progress">
      {steps.map((label, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const status = isCompleted ? 'completed' : isActive ? 'active' : 'pending';

        return (
          <div key={index} className={`wizard-progress-step wizard-progress-step--${status}`}>
            <div className="wizard-progress-indicator">
              <span className="wizard-progress-led" />
              <span className="wizard-progress-number">{index + 1}</span>
            </div>
            <span className="wizard-progress-label">{label}</span>
            {index < steps.length - 1 && <div className="wizard-progress-connector" />}
          </div>
        );
      })}
    </div>
  );
}
