import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { STYLE_TAGS, type StyleTag } from '@/config/style-tags';
import {
  addCustomAgent,
  getAllAgents,
  loadCustomAgents,
  removeCustomAgent,
  resolveAgentLocale,
  resolveAgentPrompt,
  updateCustomAgent,
  type AgentProfile
} from '@/config/agents';

interface FormValues {
  id: string;
  name: string;
  description: string;
  photographer: string;
  prompts: string;
  tagWeights: TagWeightEntry[];
}

interface TagWeightEntry {
  tag: StyleTag;
  weight: string;
}

const createEmptyValues = (): FormValues => ({
  id: '',
  name: '',
  description: '',
  photographer: '',
  prompts: '',
  tagWeights: []
});

export function CustomAgentsPanel() {
  const { t, i18n } = useTranslation();
  const [customAgents, setCustomAgents] = useState<AgentProfile[]>(loadCustomAgents());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const form = useForm<FormValues>({ defaultValues: createEmptyValues() });
  const [tagToAdd, setTagToAdd] = useState<StyleTag | ''>('');
  const [weightToAdd, setWeightToAdd] = useState('');
  const watchedTagWeights = useWatch({ control: form.control, name: 'tagWeights' }) ?? [];
  const availableTags = useMemo(
    () => STYLE_TAGS.map((tag) => `${tag} (${t(`styleTags.${tag}`)})`).join(', '),
    [t, i18n.language]
  );
  const selectedTagSet = useMemo(
    () => new Set(watchedTagWeights.map((entry) => entry.tag)),
    [watchedTagWeights]
  );
  const tagOptions = useMemo(
    () => STYLE_TAGS.filter((tag) => !selectedTagSet.has(tag)),
    [selectedTagSet]
  );

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const openNewAgent = () => {
    setEditingId(null);
    form.reset(createEmptyValues());
    setTagToAdd('');
    setWeightToAdd('');
    form.clearErrors();
    setIsDialogOpen(true);
  };

  const openEditAgent = (agent: AgentProfile) => {
    const locale = resolveAgentLocale(agent, i18n.language);
    setEditingId(agent.id);
    form.reset({
      id: agent.id,
      name: locale.name,
      description: locale.description,
      photographer: locale.photographer,
      prompts: resolveAgentPrompt(agent, i18n.language)
    });
    const entries = Object.entries(agent.tagWeights ?? {}).map(([tag, weight]) => ({
      tag: tag as StyleTag,
      weight: String(weight)
    }));
    form.setValue('tagWeights', entries, { shouldDirty: false });
    setTagToAdd('');
    setWeightToAdd('');
    form.clearErrors();
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
    const values = form.getValues();
    const trimmedId = values.id.trim();
    form.setValue('id', trimmedId);
    form.clearErrors();
    if (!trimmedId || !values.name || !values.photographer || !values.prompts) {
      if (!trimmedId) {
        form.setError('id', { message: t('customAgents.requiredField') });
        return;
      }
      if (!values.name) {
        form.setError('name', { message: t('customAgents.requiredField') });
        return;
      }
      if (!values.photographer) {
        form.setError('photographer', { message: t('customAgents.requiredField') });
        return;
      }
      form.setError('prompts', { message: t('customAgents.requiredField') });
      return;
    }

    const allAgents = getAllAgents();
    const duplicate = allAgents.some((agent) => agent.id === trimmedId && agent.id !== editingId);
    if (duplicate) {
      form.setError('id', { message: t('customAgents.duplicateId') });
      return;
    }

    const parsedWeights: AgentProfile['tagWeights'] = {};
    for (const entry of values.tagWeights ?? []) {
      const parsed = Number.parseFloat(entry.weight);
      if (!Number.isFinite(parsed)) {
        form.setError('tagWeights', { message: t('customAgents.invalidWeight') });
        return;
      }
      parsedWeights[entry.tag] = parsed;
    }

    const nextAgent: AgentProfile = {
      id: trimmedId,
      name: values.name,
      description: values.description,
      photographer: values.photographer,
      prompts: values.prompts,
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
    <Card className="border-border/50 bg-card/60 shadow-sm rounded-xl">
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
            {customAgents.map((agent) => {
              const locale = resolveAgentLocale(agent, i18n.language);
              return (
                <Card key={agent.id} className="border-border/50">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{locale.name}</p>
                        <p className="text-xs text-muted-foreground">{locale.photographer}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditAgent(agent)}>
                          {t('customAgents.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(agent.id)}
                        >
                          {t('customAgents.delete')}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{locale.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t('customAgents.editTitle') : t('customAgents.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('customAgents.description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('customAgents.idLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => field.onChange(event.target.value.trim())}
                        placeholder={t('customAgents.idPlaceholder')}
                        disabled={isEditing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('customAgents.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('customAgents.namePlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="photographer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('customAgents.photographerLabel')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('customAgents.photographerPlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('customAgents.descriptionLabel')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder={t('customAgents.descriptionPlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prompts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('customAgents.promptLabel')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder={t('customAgents.promptPlaceholder')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tagWeights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('customAgents.tagWeightsLabel')}</FormLabel>
                    <FormControl>
                      <Card className="border-border/50">
                        <CardContent className="p-3 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select
                              value={tagToAdd}
                              onValueChange={(value) => setTagToAdd(value as StyleTag)}
                            >
                              <SelectTrigger className="sm:flex-1">
                                <SelectValue placeholder={t('customAgents.tagSelectPlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {tagOptions.map((tag) => (
                                  <SelectItem key={tag} value={tag}>
                                    {tag} ({t(`styleTags.${tag}`)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={weightToAdd}
                              onChange={(event) => setWeightToAdd(event.target.value)}
                              placeholder={t('customAgents.tagWeightPlaceholder')}
                              className="sm:w-40"
                            />
                            <Button
                              variant="outline"
                              onClick={() => {
                                if (!tagToAdd) {
                                  return;
                                }
                                const parsed = Number.parseFloat(weightToAdd);
                                if (!Number.isFinite(parsed)) {
                                  form.setError('tagWeights', {
                                    message: t('customAgents.invalidWeight')
                                  });
                                  return;
                                }
                                const nextValues = [
                                  ...(field.value ?? []),
                                  {
                                    tag: tagToAdd,
                                    weight: weightToAdd
                                  }
                                ];
                                field.onChange(nextValues);
                                form.clearErrors('tagWeights');
                                setTagToAdd('');
                                setWeightToAdd('');
                              }}
                              disabled={!tagToAdd || tagOptions.length === 0}
                            >
                              {t('customAgents.addTagButton')}
                            </Button>
                          </div>

                          {(field.value ?? []).length > 0 && (
                            <div className="space-y-2">
                              {(field.value ?? []).map((entry) => (
                                <Card key={entry.tag} className="border-border/50">
                                  <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                                    <div className="text-sm text-foreground sm:flex-1">
                                      {entry.tag} ({t(`styleTags.${entry.tag}`)})
                                    </div>
                                    <Input
                                      value={entry.weight}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        const nextEntries = (field.value ?? []).map((item) =>
                                          item.tag === entry.tag
                                            ? { ...item, weight: nextValue }
                                            : item
                                        );
                                        field.onChange(nextEntries);
                                      }}
                                      placeholder={t('customAgents.tagWeightPlaceholder')}
                                      className="sm:w-40"
                                    />
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        const nextEntries = (field.value ?? []).filter(
                                          (item) => item.tag !== entry.tag
                                        );
                                        field.onChange(nextEntries);
                                      }}
                                    >
                                      {t('customAgents.removeTag')}
                                    </Button>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      {t('customAgents.tagWeightsHelp', { tags: availableTags })}
                    </FormDescription>
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  {t('customAgents.cancel')}
                </Button>
                <Button className="flex-1" onClick={handleSave}>
                  {t('customAgents.save')}
                </Button>
              </div>
            </div>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
