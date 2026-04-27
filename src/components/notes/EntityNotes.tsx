import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, NotebookPen, Pencil, Trash2, Check, X } from 'lucide-react';

export type EntityType = 'cliente' | 'cedente' | 'sacado';

interface EntityNotesProps {
  entityType: EntityType;
  entityCpfCnpj: string;
  entityName?: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string | null;
}

const entityLabels: Record<EntityType, string> = {
  cliente: 'cliente',
  cedente: 'cedente',
  sacado: 'sacado',
};

export function EntityNotes({ entityType, entityCpfCnpj, entityName }: EntityNotesProps) {
  const { user, profile, isAdmin } = useAuth() as any;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('entity_notes')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_cpf_cnpj', entityCpfCnpj)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar notas');
    } else {
      setNotes((data || []) as Note[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (entityCpfCnpj) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityCpfCnpj]);

  const handleAdd = async () => {
    if (!content.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('entity_notes').insert({
      entity_type: entityType,
      entity_cpf_cnpj: entityCpfCnpj,
      entity_name: entityName ?? null,
      content: content.trim(),
      created_by: user.id,
      created_by_name: profile?.name || user.email || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar nota');
      return;
    }
    setContent('');
    toast.success('Nota adicionada');
    load();
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase
      .from('entity_notes')
      .update({ content: editContent.trim() })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar nota');
      return;
    }
    setEditingId(null);
    toast.success('Nota atualizada');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta nota?')) return;
    const { error } = await supabase.from('entity_notes').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir nota');
      return;
    }
    toast.success('Nota excluída');
    load();
  };

  const canEdit = (note: Note) => user && (note.created_by === user.id || isAdmin);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <NotebookPen className="h-4 w-4 text-primary" />
          Notas do {entityLabels[entityType]}
          {notes.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {notes.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder={`Adicione uma observação sobre este ${entityLabels[entityType]}…`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={!content.trim() || saving}>
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Adicionar nota
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              Nenhuma nota registrada ainda.
            </p>
          ) : (
            notes.map((note) => {
              const isEditing = editingId === note.id;
              const editedAt =
                note.updated_at !== note.created_at
                  ? ` · editada ${new Date(note.updated_at).toLocaleDateString('pt-BR')}`
                  : '';
              return (
                <div
                  key={note.id}
                  className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {note.created_by_name || 'Usuário'}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(note.created_at).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                        {editedAt}
                      </span>
                    </div>
                    {canEdit(note) && !isEditing && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditContent(note.content);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(note.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="resize-none text-sm"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="mr-1 h-3 w-3" /> Cancelar
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(note.id)}>
                          <Check className="mr-1 h-3 w-3" /> Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-foreground">
                      {note.content}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
