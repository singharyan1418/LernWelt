import React, { useMemo, useState } from 'react';
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Lock,
  Smartphone,
  X
} from 'lucide-react';
import {
  PersonalTeacher,
  TeacherAccessPass,
  TeacherPaymentMethod,
  UserProfile
} from '../../types';
import {
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

const POPULAR_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India (SBI)',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Yes Bank'
];

export const TeacherPaymentModal: React.FC<TeacherPaymentModalProps> = ({
  userProfile,
  targetTeacher,
  onClose,
  onPaymentSuccess
}) => {
  const uiLang = userProfile.nativeLanguage;
  const [paymentMethod, setPaymentMethod] = useState<TeacherPaymentMethod>('upi');
  const [upiId, setUpiId] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>(userProfile.name || '');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const [bankName, setBankName] = useState<string>(POPULAR_BANKS[0]);
  const [accountHolder, setAccountHolder] = useState<string>(userProfile.name || '');
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

  const handleCardNumberChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 16);
    const grouped = digits.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(grouped);
    if (errorMsg) setErrorMsg(null);
  };

  const handleExpiryChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setCardExpiry(formatted);
    if (errorMsg) setErrorMsg(null);
  };

  const teacherDisplayName = targetTeacher?.name || 'this teacher';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeacher?.id) {
      setErrorMsg('Please select a teacher to unlock for ₹999 / month.');
      return;
    }
    const check = validateTeacherPaymentInput({
      paymentMethod,
      amountInr: TEACHER_ACCESS_PRICE_INR,
      upiId,
      cardHolder,
      cardNumber,
      cardExpiry,
      cardCvv,
      bankName,
      accountHolder
    });

    if (!check.valid) {
      setErrorMsg(check.error || 'Please enter valid payment details.');
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
          paymentMethod,
          amountInr: TEACHER_ACCESS_PRICE_INR,
          upiId: upiId.trim(),
          cardHolder: cardHolder.trim(),
          cardNumber: cardNumber.trim(),
          cardExpiry: cardExpiry.trim(),
          cardCvv: cardCvv.trim(),
          bankName: bankName.trim(),
          accountHolder: accountHolder.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.pass) {
        setErrorMsg(data?.error || 'Could not process ₹999 payment. Please try again.');
        return;
      }

      onPaymentSuccess(data.pass as TeacherAccessPass);
    } catch {
      setErrorMsg('Network error while confirming your ₹999 payment. Please try again.');
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
      <div className="bg-white dark:bg-[#161D27] border border-slate-200 dark:border-[#293342] rounded-xl max-w-lg w-full p-6 shadow-2xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.75)] space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#293342]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#6485F5]/15 border border-[#6485F5]/30 flex items-center justify-center text-[#6485F5] shrink-0">
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
        <div className="rounded-xl bg-slate-50 dark:bg-[#10151D] border border-slate-200 dark:border-[#293342] p-4 space-y-3">
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
              <span className="text-xl font-bold text-slate-900 dark:text-[#F0F2F5] tabular-nums">
                {t('teachers.payModalPriceValue', uiLang)}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-[#9BA6B2]">/ 1 month</span>
            </div>
          </div>

          <ul className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#293342] text-xs text-slate-700 dark:text-[#CBD5E1]">
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

        {/* Payment Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium"
            >
              {errorMsg}
            </div>
          )}

          <div>
            <span className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-2">
              {t('teachers.payMethodLabel', uiLang)}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('upi');
                  setErrorMsg(null);
                }}
                aria-pressed={paymentMethod === 'upi'}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border font-medium transition-colors cursor-pointer ${
                  paymentMethod === 'upi'
                    ? 'bg-[#6485F5] text-white border-[#6485F5]'
                    : 'bg-slate-50 dark:bg-[#10151D] text-slate-700 dark:text-[#CBD5E1] border-slate-300 dark:border-[#293342] hover:bg-slate-100 dark:hover:bg-[#1B2430]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>{t('teachers.payMethodUpi', uiLang)}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('card');
                  setErrorMsg(null);
                }}
                aria-pressed={paymentMethod === 'card'}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border font-medium transition-colors cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-[#6485F5] text-white border-[#6485F5]'
                    : 'bg-slate-50 dark:bg-[#10151D] text-slate-700 dark:text-[#CBD5E1] border-slate-300 dark:border-[#293342] hover:bg-slate-100 dark:hover:bg-[#1B2430]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>{t('teachers.payMethodCard', uiLang)}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('netbanking');
                  setErrorMsg(null);
                }}
                aria-pressed={paymentMethod === 'netbanking'}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border font-medium transition-colors cursor-pointer ${
                  paymentMethod === 'netbanking'
                    ? 'bg-[#6485F5] text-white border-[#6485F5]'
                    : 'bg-slate-50 dark:bg-[#10151D] text-slate-700 dark:text-[#CBD5E1] border-slate-300 dark:border-[#293342] hover:bg-slate-100 dark:hover:bg-[#1B2430]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t('teachers.payMethodNetbanking', uiLang)}</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'upi' && (
            <div>
              <label htmlFor="teacher-pay-upi-input" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                {t('teachers.payUpiLabel', uiLang)}
              </label>
              <input
                id="teacher-pay-upi-input"
                type="text"
                value={upiId}
                onChange={(e) => {
                  setUpiId(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={t('teachers.payUpiPlaceholder', uiLang)}
                className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
              />
            </div>
          )}

          {paymentMethod === 'card' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="teacher-pay-card-holder" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                  {t('teachers.payCardHolderLabel', uiLang)}
                </label>
                <input
                  id="teacher-pay-card-holder"
                  type="text"
                  value={cardHolder}
                  onChange={(e) => {
                    setCardHolder(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={t('teachers.payCardHolderPlaceholder', uiLang)}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                />
              </div>

              <div>
                <label htmlFor="teacher-pay-card-number" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                  {t('teachers.payCardNumberLabel', uiLang)}
                </label>
                <input
                  id="teacher-pay-card-number"
                  type="text"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="teacher-pay-card-expiry" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                    {t('teachers.payCardExpiryLabel', uiLang)}
                  </label>
                  <input
                    id="teacher-pay-card-expiry"
                    type="text"
                    inputMode="numeric"
                    value={cardExpiry}
                    onChange={(e) => handleExpiryChange(e.target.value)}
                    placeholder="12/28"
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="teacher-pay-card-cvv" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                    {t('teachers.payCardCvvLabel', uiLang)}
                  </label>
                  <input
                    id="teacher-pay-card-cvv"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => {
                      setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="123"
                    className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'netbanking' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="teacher-pay-bank-select" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                  {t('teachers.payBankLabel', uiLang)}
                </label>
                <select
                  id="teacher-pay-bank-select"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] focus:outline-none focus:border-[#6485F5] transition-colors"
                >
                  {POPULAR_BANKS.map(bank => (
                    <option key={bank} value={bank} className="bg-white dark:bg-[#161D27] text-slate-900 dark:text-[#F0F2F5]">
                      {bank}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="teacher-pay-account-holder" className="block text-slate-700 dark:text-[#F0F2F5] font-medium mb-1.5">
                  {t('teachers.payAccountHolderLabel', uiLang)}
                </label>
                <input
                  id="teacher-pay-account-holder"
                  type="text"
                  value={accountHolder}
                  onChange={(e) => {
                    setAccountHolder(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={t('teachers.payCardHolderPlaceholder', uiLang)}
                  className="w-full bg-slate-50 dark:bg-[#10151D] border border-slate-300 dark:border-[#293342] rounded-lg px-3 py-2.5 text-slate-900 dark:text-[#F0F2F5] placeholder-slate-400 dark:placeholder-[#9BA6B2] focus:outline-none focus:border-[#6485F5] transition-colors"
                />
              </div>
            </div>
          )}

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
