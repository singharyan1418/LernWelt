import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Lock,
  QrCode,
  X
} from 'lucide-react';
import {
  PersonalTeacher,
  TeacherAccessPass,
  UserProfile
} from '../../types';
import {
  PAYMENT_QR_IMAGE_URL,
  TEACHER_ACCESS_PRICE_INR,
  addOneMonthFromDate,
  formatTeacherPassDate,
  validateTeacherPaymentInput
} from '../../services/teacherAccessService';
import { t } from '../../services/uiLocalization';

interface TeacherPaymentModalProps {
  userProfile: UserProfile;
  targetTeacher?: PersonalTeacher | null;
  onClose: () => void;
  onPaymentSuccess: (pass: TeacherAccessPass) => void;
}

export const TeacherPaymentModal: React.FC<TeacherPaymentModalProps> = ({
  userProfile,
  targetTeacher,
  onClose,
  onPaymentSuccess
}) => {
  const uiLang = userProfile.nativeLanguage;
  const [qrConfirmed, setQrConfirmed] = useState<boolean>(false);
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const previewDates = useMemo(() => {
    const startMs = Date.now();
    const endMs = addOneMonthFromDate(startMs);
    return {
      startDate: formatTeacherPassDate(startMs, uiLang),
      endDate: formatTeacherPassDate(endMs, uiLang)
    };
  }, [uiLang]);

  const teacherDisplayName = targetTeacher?.name || 'this teacher';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeacher?.id) {
      setErrorMsg('Please select a teacher to unlock for ₹999 / month.');
      return;
    }

    const check = validateTeacherPaymentInput({
      paymentMethod: 'qr',
      amountInr: TEACHER_ACCESS_PRICE_INR,
      qrConfirmed,
      transactionReference
    });

    if (!check.valid) {
      setErrorMsg(check.error || 'Please scan the QR code and confirm your ₹999 payment.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/teachers/access/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile.id,
          teacherId: targetTeacher.id,
          teacherName: targetTeacher.name,
          userName: userProfile.name,
          userEmail: userProfile.email,
          paymentMethod: 'qr',
          amountInr: TEACHER_ACCESS_PRICE_INR,
          qrConfirmed,
          transactionReference: transactionReference.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.pass) {
        setErrorMsg(data?.error || 'Could not confirm ₹999 QR payment. Please try again.');
        return;
      }

      onPaymentSuccess(data.pass as TeacherAccessPass);
    } catch {
      setErrorMsg('Network error while confirming your ₹999 QR payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-payment-modal-title"
    >
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl max-w-lg w-full p-5 shadow-2xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.75)] space-y-3.5 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#293342]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#6485F5]/15 border border-[#6485F5]/30 flex items-center justify-center text-[#6485F5] shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3
                id="teacher-payment-modal-title"
                className="font-semibold text-base text-slate-900 dark:text-[#F0F2F5]"
              >
                {t('teachers.payModalTitle', uiLang)}
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#9BA6B2] mt-0.5 leading-relaxed">
                {targetTeacher
                  ? t('teachers.payModalContext', uiLang, { name: teacherDisplayName })
                  : t('teachers.payModalSubtitle', uiLang)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-[#9BA6B2] hover:text-slate-900 dark:hover:text-[#F0F2F5] hover:bg-slate-100 dark:hover:bg-[#1B2430] transition-colors cursor-pointer shrink-0"
            aria-label={t('common.close', uiLang)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plan & 1-Month Validity Summary */}
        <div className="rounded-xl bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-[#F0F2F5]">
                {t('teachers.payModalPriceLabel', uiLang, { name: teacherDisplayName })}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-[#9BA6B2] mt-0.5 flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {t('teachers.payModalDuration', uiLang, {
                    startDate: previewDates.startDate,
                    endDate: previewDates.endDate
                  })}
                </span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-lg font-bold text-slate-900 dark:text-[#F0F2F5] tabular-nums">
                {t('teachers.payModalPriceValue', uiLang)}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-[#9BA6B2]">/ 1 month</span>
            </div>
          </div>

          <ul className="space-y-1 pt-2 border-t border-slate-200 dark:border-[#293342] text-[11px] text-slate-700 dark:text-[#CBD5E1]">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t('teachers.payModalIncludes1', uiLang, { name: teacherDisplayName })}</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t('teachers.payModalIncludes2', uiLang, { name: teacherDisplayName })}</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t('teachers.payModalIncludes3', uiLang, { name: teacherDisplayName })}</span>
            </li>
          </ul>
        </div>

        {/* QR-Only Payment Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-3 text-xs">
          {errorMsg && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium"
            >
              {errorMsg}
            </div>
          )}

          <div className="rounded-xl bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] p-3.5 space-y-2.5">
            <div className="flex items-center justify-center gap-2 text-slate-900 dark:text-[#F0F2F5] font-semibold">
              <QrCode className="w-4 h-4 text-[#6485F5] shrink-0" />
              <span>{t('teachers.payMethodLabel', uiLang)}</span>
            </div>

            <p className="text-[11px] text-center text-slate-600 dark:text-[#9BA6B2] leading-relaxed">
              {t('teachers.payQrInstruction', uiLang, { name: teacherDisplayName })}
            </p>

            <div className="flex justify-center">
              <div className="bg-white rounded-xl p-1.5 border border-slate-200 shadow-xs max-w-[180px] w-full">
                <img
                  src={PAYMENT_QR_IMAGE_URL}
                  alt={t('teachers.payQrImageAlt', uiLang)}
                  data-testid="payment-qr-image"
                  className="w-full h-auto rounded-lg object-contain block"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="teacher-pay-qr-ref"
              className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1"
            >
              {t('teachers.payQrRefLabel', uiLang)}
            </label>
            <input
              id="teacher-pay-qr-ref"
              type="text"
              value={transactionReference}
              onChange={(e) => {
                setTransactionReference(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={t('teachers.payQrRefPlaceholder', uiLang)}
              className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
            />
          </div>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] cursor-pointer select-none">
            <input
              id="teacher-pay-qr-confirm"
              type="checkbox"
              checked={qrConfirmed}
              onChange={(e) => {
                setQrConfirmed(e.target.checked);
                if (errorMsg) setErrorMsg(null);
              }}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-[#293342] text-[#6485F5] focus:ring-[#6485F5] cursor-pointer shrink-0"
            />
            <span className="text-xs text-slate-800 dark:text-[#F0F2F5] font-medium leading-snug">
              {t('teachers.payQrConfirmLabel', uiLang)}
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#1B2430] hover:bg-slate-200 dark:hover:bg-[#232F3F] border border-slate-300 dark:border-[#293342] text-slate-800 dark:text-[#F0F2F5] font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('common.cancel', uiLang)}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-[#6485F5] hover:bg-[#7593F7] disabled:opacity-40 text-white font-semibold border border-[#6485F5]/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.45)] transition-colors cursor-pointer whitespace-nowrap"
            >
              {isSubmitting
                ? t('teachers.payProcessing', uiLang)
                : t('teachers.paySubmitBtn', uiLang, { name: teacherDisplayName })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
