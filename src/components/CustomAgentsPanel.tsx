import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  addCustomAgent,
  getAllAgents,
  loadCustomAgents,
  removeCustomAgent,
  updateCustomAgent,
  type AgentProfile
} from '@/config/agents';

const createEmptyAgent = (): AgentProfile => ({
  id: '',
  name: '',
  description: '',
  photographer: '',
  tagWeights: {},
  prompt: ''
});

export function CustomAgentsPanel() {
  const { t } = useTranslation();
  const [customAgents, setCustomAgents] = useState<AgentProfile[]>(loadCustomAgents());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAgent, setFormAgent] = useState<AgentProfile>(createEmptyAgent());
  const [tagWeightsInput, setTagWeightsInput] = useState('{}');
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const openNewAgent = () => {
    setEditingId(null);
    setFormAgent(createEmptyAgent());
    setTagWeightsInput('{}');
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditAgent = (agent: AgentProfile) => {
    setEditingId(agent.id);
    setFormAgent(agent);
    setTagWeightsInput(JSON.stringify(agent.tagWeights ?? {}, null, 2));
    setFormError(null);
    setIsDialogOpen(true);
  };

  const refreshAgents = () => {
    setCustomAgents(loadCustomAgents());
    window.dispatchEvent(new Event('custom-agents-updated'));
  };

  const handleDelete = (agentId: string) => {
    removeCustomAgent(agentId);
    refreshAgents();
  };

  const handleSave = () => {
    if (!formAgent.id || !formAgent.name || !formAgent.photographer || !formAgent.prompt) {
      setFormError(t('customAgents.requiredField'));
      return;
    }

    const allAgents = getAllAgents();
    const duplicate = allAgents.some((agent) => agent.id === formAgent.id && agent.id !== editingId);
    if (duplicate) {
      setFormError(t('customAgents.duplicateId'));
      return;
    }

    let parsedWeights: AgentProfile['tagWeights'] = {};
    if (tagWeightsInput.trim()) {
      try {
        parsedWeights = JSON.parse(tagWeightsInput) as AgentProfile['tagWeights'];
      } catch {
        setFormError(t('customAgents.invalidJson'));
        return;
      }
    }

    const nextAgent: AgentProfile = {
      ...formAgent,
      tagWeights: parsedWeights
    };

    if (isEditing) {
      updateCustomAgent(nextAgent);
    } else {
      addCustomAgent(nextAgent);
    }

    refreshAgents();
    setIsDialogOpen(false);
  };

  return (
    <Card className="border-border/60 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('customAgents.title')}</CardTitle>
        <CardDescription>{t('customAgents.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full" onClick={openNewAgent}>
          {t('customAgents.add')}
        </Button>

        {customAgents.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('customAgents.empty')}</p>
        ) : (
          <div className="space-y-2">
            {customAgents.map((agent) => (
              <Card key={agent.id} className="border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.photographer}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditAgent(agent)}>
                        {t('customAgents.edit')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(agent.id)}>
                        {t('customAgents.delete')}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{agent.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t('customAgents.editTitle') : t('customAgents.createTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="agent-id">{t('customAgents.idLabel')}</Label>
              <Input
                id="agent-id"
                value={formAgent.id}
                onChange={(event) =>
                  setFormAgent((prev) => ({ ...prev, id: event.target.value.trim() }))
                }
                placeholder={t('customAgents.idPlaceholder')}
                disabled={isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-name">{t('customAgents.nameLabel')}</Label>
              <Input
                id="agent-name"
                value={formAgent.name}
                onChange={(event) =>
                  setFormAgent((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder={t('customAgents.namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-photographer">{t('customAgents.photographerLabel')}</Label>
              <Input
                id="agent-photographer"
                value={formAgent.photographer}
                onChange={(event) =>
                  setFormAgent((prev) => ({ ...prev, photographer: event.target.value }))
                }
                placeholder={t('customAgents.photographerPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-description">{t('customAgents.descriptionLabel')}</Label>
              <Textarea
                id="agent-description"
                value={formAgent.description}
                onChange={(event) =>
                  setFormAgent((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder={t('customAgents.descriptionPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-prompt">{t('customAgents.promptLabel')}</Label>
              <Textarea
                id="agent-prompt"
                value={formAgent.prompt}
                onChange={(event) =>
                  setFormAgent((prev) => ({ ...prev, prompt: event.target.value }))
                }
                placeholder={t('customAgents.promptPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-weights">{t('customAgents.tagWeightsLabel')}</Label>
              <Textarea
                id="agent-weights"
                value={tagWeightsInput}
                onChange={(event) => setTagWeightsInput(event.target.value)}
                placeholder={t('customAgents.tagWeightsPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('customAgents.tagWeightsHelp')}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                {t('customAgents.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                {t('customAgents.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
