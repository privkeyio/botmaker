import { useState } from 'react';
import type { CreateBotInput } from '../types';
import { AI_PROVIDERS, MODELS, getDefaultModel } from '../config/providers';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { WizardProgress } from './WizardProgress';
import './CreateWizard.css';

interface CreateWizardProps {
  onClose: () => void;
  onSubmit: (input: CreateBotInput) => Promise<void>;
}

const STEPS = ['Name & Model', 'API Key', 'Channel', 'Persona', 'Review'];

export function CreateWizard({ onClose, onSubmit }: CreateWizardProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreateBotInput>({
    name: '',
    ai_provider: 'openai',
    model: 'gpt-5.2',
    channel_type: 'telegram',
    channel_token: '',
    api_key: '',
    persona: {
      name: '',
      identity: '',
      description: '',
    },
  });

  const updateField = <K extends keyof CreateBotInput>(
    field: K,
    value: CreateBotInput[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updatePersona = (field: keyof CreateBotInput['persona'], value: string) => {
    setFormData((prev) => ({
      ...prev,
      persona: { ...prev.persona, [field]: value },
    }));
  };

  const validateStep = (): boolean => {
    setError('');

    switch (step) {
      case 0:
        if (!formData.name.trim()) {
          setError('Bot name is required');
          return false;
        }
        break;
      case 1:
        if (!formData.api_key.trim()) {
          setError('API key is required');
          return false;
        }
        break;
      case 2:
        if (!formData.channel_token.trim()) {
          setError('Channel token is required');
          return false;
        }
        break;
      case 3:
        if (!formData.persona.name.trim()) {
          setError('Persona name is required');
          return false;
        }
        if (!formData.persona.identity.trim()) {
          setError('Persona identity is required');
          return false;
        }
        if (!formData.persona.description.trim()) {
          setError('Persona description is required');
          return false;
        }
        break;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setStep((s) => s - 1);
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="wizard-step-content">
            <div className="wizard-form-group">
              <label className="wizard-label">Bot Name</label>
              <input
                type="text"
                className="wizard-input"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="my-awesome-bot"
                autoFocus
              />
              <span className="wizard-hint">Unique identifier for your bot</span>
            </div>
            <div className="wizard-form-group">
              <label className="wizard-label">AI Provider</label>
              <select
                className="wizard-select"
                value={formData.ai_provider}
                onChange={(e) => {
                  updateField('ai_provider', e.target.value);
                  updateField('model', getDefaultModel(e.target.value));
                }}
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="wizard-form-group">
              <label className="wizard-label">Model</label>
              <select
                className="wizard-select"
                value={formData.model}
                onChange={(e) => updateField('model', e.target.value)}
              >
                {(MODELS[formData.ai_provider] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="wizard-step-content">
            <div className="wizard-form-group">
              <label className="wizard-label">{formData.ai_provider.toUpperCase()} API Key</label>
              <input
                type="password"
                className="wizard-input"
                value={formData.api_key}
                onChange={(e) => updateField('api_key', e.target.value)}
                placeholder="sk-..."
                autoFocus
              />
              <span className="wizard-hint">Your API key is stored securely and never exposed</span>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="wizard-step-content">
            <div className="wizard-form-group">
              <label className="wizard-label">Channel Type</label>
              <div className="wizard-channel-grid">
                <button
                  type="button"
                  className={`wizard-channel-option ${formData.channel_type === 'telegram' ? 'wizard-channel-option--selected' : ''}`}
                  onClick={() => updateField('channel_type', 'telegram')}
                >
                  <span className="wizard-channel-icon">TG</span>
                  <span className="wizard-channel-name">Telegram</span>
                </button>
                <button
                  type="button"
                  className={`wizard-channel-option ${formData.channel_type === 'discord' ? 'wizard-channel-option--selected' : ''}`}
                  onClick={() => updateField('channel_type', 'discord')}
                >
                  <span className="wizard-channel-icon">DC</span>
                  <span className="wizard-channel-name">Discord</span>
                </button>
              </div>
            </div>
            <div className="wizard-form-group">
              <label className="wizard-label">Bot Token</label>
              <input
                type="password"
                className="wizard-input"
                value={formData.channel_token}
                onChange={(e) => updateField('channel_token', e.target.value)}
                placeholder={
                  formData.channel_type === 'telegram'
                    ? '123456:ABC-DEF...'
                    : 'MTA2...'
                }
              />
              <span className="wizard-hint">
                {formData.channel_type === 'telegram'
                  ? 'Get this from @BotFather on Telegram'
                  : 'Get this from Discord Developer Portal'}
              </span>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="wizard-step-content">
            <div className="wizard-form-group">
              <label className="wizard-label">Persona Name</label>
              <input
                type="text"
                className="wizard-input"
                value={formData.persona.name}
                onChange={(e) => updatePersona('name', e.target.value)}
                placeholder="Assistant"
                autoFocus
              />
              <span className="wizard-hint">Display name for the bot persona</span>
            </div>
            <div className="wizard-form-group">
              <label className="wizard-label">Identity</label>
              <textarea
                className="wizard-textarea"
                value={formData.persona.identity}
                onChange={(e) => updatePersona('identity', e.target.value)}
                placeholder="You are a helpful assistant..."
                rows={3}
              />
              <span className="wizard-hint">Core identity and personality traits</span>
            </div>
            <div className="wizard-form-group">
              <label className="wizard-label">Description</label>
              <textarea
                className="wizard-textarea"
                value={formData.persona.description}
                onChange={(e) => updatePersona('description', e.target.value)}
                placeholder="A friendly bot that helps users with..."
                rows={3}
              />
              <span className="wizard-hint">What the bot does and how it behaves</span>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="wizard-step-content">
            <Panel variant="inset" className="wizard-review-section">
              <div className="wizard-review-header">Bot Configuration</div>
              <div className="wizard-review-grid">
                <div className="wizard-review-item">
                  <span className="wizard-review-label">Name</span>
                  <span className="wizard-review-value">{formData.name}</span>
                </div>
                <div className="wizard-review-item">
                  <span className="wizard-review-label">Provider</span>
                  <span className="wizard-review-value">{formData.ai_provider}</span>
                </div>
                <div className="wizard-review-item">
                  <span className="wizard-review-label">Model</span>
                  <span className="wizard-review-value">{formData.model}</span>
                </div>
                <div className="wizard-review-item">
                  <span className="wizard-review-label">Channel</span>
                  <span className="wizard-review-value">{formData.channel_type}</span>
                </div>
              </div>
            </Panel>
            <Panel variant="inset" className="wizard-review-section">
              <div className="wizard-review-header">Persona</div>
              <div className="wizard-review-grid wizard-review-grid--full">
                <div className="wizard-review-item">
                  <span className="wizard-review-label">Name</span>
                  <span className="wizard-review-value">{formData.persona.name}</span>
                </div>
                <div className="wizard-review-item">
                  <span className="wizard-review-label">Identity</span>
                  <span className="wizard-review-value wizard-review-value--wrap">{formData.persona.identity}</span>
                </div>
                <div className="wizard-review-item">
                  <span className="wizard-review-label">Description</span>
                  <span className="wizard-review-value wizard-review-value--wrap">{formData.persona.description}</span>
                </div>
              </div>
            </Panel>
          </div>
        );

      default:
        return null;
    }
  };

  const footer = (
    <>
      <Button
        variant="ghost"
        onClick={handleBack}
        disabled={step === 0 || submitting}
      >
        Back
      </Button>
      {step < STEPS.length - 1 ? (
        <Button variant="primary" onClick={handleNext}>
          Next
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
        >
          Create Bot
        </Button>
      )}
    </>
  );

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Bot" footer={footer} size="md">
      <WizardProgress steps={STEPS} currentStep={step} />
      {error && (
        <div className="wizard-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      {renderStepContent()}
    </Modal>
  );
}
