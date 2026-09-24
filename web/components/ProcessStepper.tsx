interface ProcessStepperProps {
  currentStep: number;
}

const steps = ['Briefing', 'Escolha', 'Exporte'];

export function ProcessStepper({ currentStep }: ProcessStepperProps) {
  return (
    <ol className="process-stepper" aria-label="Etapas do processo">
      {steps.map((label, index) => {
        const number = index + 1;
        const completed = number < currentStep;
        const current = number === currentStep;
        return (
          <li className={completed ? 'completed' : current ? 'current' : ''} key={label} aria-current={current ? 'step' : undefined}>
            <span className="step-marker" aria-hidden="true">{completed ? '✓' : number}</span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
