import { supabase } from '@/integrations/supabase/client';
import type { Certificado } from '@/lib/assinatura-api';

export interface GoldCreditCertificatePreference {
  gold_credit_cert_subject_cn?: string | null;
  gold_credit_cert_document?: string | null;
  gold_credit_cert_serial_number?: string | null;
  gold_credit_cert_tipo?: string | null;
  gold_credit_cert_issuer_cn?: string | null;
  gold_credit_cert_linked_by_email?: string | null;
  gold_credit_cert_linked_at?: string | null;
}

function normalizeDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

export function matchGoldCreditCertificate(
  certificates: Certificado[],
  preference: GoldCreditCertificatePreference | null | undefined,
) {
  if (!preference || certificates.length === 0) {
    return null;
  }

  const serial = String(preference.gold_credit_cert_serial_number || '').trim().toLowerCase();
  if (serial) {
    const serialMatch = certificates.find((cert) => String(cert.serial_number || '').trim().toLowerCase() === serial);
    if (serialMatch) return serialMatch;
  }

  const document = normalizeDigits(preference.gold_credit_cert_document);
  const subject = String(preference.gold_credit_cert_subject_cn || '').trim().toLowerCase();

  const documentMatches = certificates.filter((cert) => normalizeDigits(cert.cpf_cnpj) === document);
  if (documentMatches.length === 1) {
    return documentMatches[0];
  }

  if (documentMatches.length > 1 && subject) {
    const subjectMatch = documentMatches.find((cert) => String(cert.subject_cn || '').trim().toLowerCase() === subject);
    if (subjectMatch) return subjectMatch;
  }

  return documentMatches[0] || null;
}

export async function getGoldCreditCertificatePreference() {
  const { data, error } = await supabase.functions.invoke('goldsign-settings', {
    body: { action: 'get' },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.data || null) as GoldCreditCertificatePreference | null;
}

export async function saveGoldCreditCertificatePreference(cert: Certificado) {
  const { data, error } = await supabase.functions.invoke('goldsign-settings', {
    body: {
      action: 'set',
      gold_credit_cert_subject_cn: cert.subject_cn || null,
      gold_credit_cert_document: normalizeDigits(cert.cpf_cnpj),
      gold_credit_cert_serial_number: cert.serial_number || null,
      gold_credit_cert_tipo: cert.tipo || null,
      gold_credit_cert_issuer_cn: cert.issuer_cn || null,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.data || null) as GoldCreditCertificatePreference | null;
}

export async function clearGoldCreditCertificatePreference() {
  const { data, error } = await supabase.functions.invoke('goldsign-settings', {
    body: { action: 'clear' },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
