import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreditCard, Lock, ShieldCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../lib/api';
import { formatMoney, formatPrice, learnPath } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { getError } from '../lib/async';

const DEMO_CARD = {
  name: 'Demo',
  number: '4242',
  expiry: '12/30',
  cvc: '123',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Checkout() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [course, setCourse] = useState(null);
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const handledReturn = useRef(false);

  useEffect(() => {
    api.get(`/courses/${courseId}`).then((r) => setCourse(r.data.course)).catch(() => {});
  }, [courseId]);

  useEffect(() => {
    const eps = searchParams.get('eps');
    const mtxn = searchParams.get('mtxn') || sessionStorage.getItem('eps_mtxn');
    if (!eps || handledReturn.current) return;

    const finishSuccess = (loadedCourse) => {
      sessionStorage.removeItem('eps_amount');
      sessionStorage.removeItem('eps_mtxn');
      success('Payment confirmed. You are enrolled.');
      if (loadedCourse) navigate(learnPath(loadedCourse), { state: { enrolled: true } });
    };

    const run = async () => {
      if (eps === 'success') {
        if (!course) return;
        handledReturn.current = true;
        finishSuccess(course);
        setSearchParams({}, { replace: true });
        return;
      }

      handledReturn.current = true;

      if (eps === 'cancelled') {
        setBanner('Payment cancelled. No charge was made.');
        setSearchParams({}, { replace: true });
        return;
      }

      if (!mtxn) {
        setBanner(eps === 'pending' ? 'Payment is still processing.' : 'Payment was not completed.');
        setSearchParams({}, { replace: true });
        return;
      }

      setBanner('Confirming your payment with EPS…');
      for (let i = 0; i < 5; i += 1) {
        try {
          const { data } = await api.post('/enrollments/checkout/eps/verify', {
            merchantTransactionId: mtxn,
          });
          if (data.paid) {
            const loaded = course || (await api.get(`/courses/${courseId}`)).data.course;
            finishSuccess(loaded);
            setSearchParams({}, { replace: true });
            return;
          }
          if (data.status === 'failed' || data.status === 'rejected' || data.status === 'amount-mismatch') {
            setBanner('Payment failed. You were not enrolled.');
            setSearchParams({}, { replace: true });
            return;
          }
        } catch {
          /* keep polling */
        }
        await sleep(2000);
      }
      setBanner('Payment is still pending. If you were charged, enrollment will appear shortly.');
      setSearchParams({}, { replace: true });
    };

    run();
  }, [searchParams, course, courseId, navigate, success, setSearchParams]);

  const payEps = async () => {
    setLoading(true);
    setError('');
    setBanner('');
    try {
      const { data } = await api.post('/enrollments/checkout/eps', { course_id: courseId });
      if (data.enrolled) {
        success(data.message || 'You are enrolled.');
        navigate(learnPath(course), { state: { enrolled: true } });
        return;
      }
      sessionStorage.setItem('eps_amount', String(formatPrice(course.price, course.discount_price).current));
      sessionStorage.setItem('eps_mtxn', data.merchantTransactionId);
      window.location.href = data.redirectUrl;
    } catch (err) {
      const message = getError(err, 'Could not start EPS payment');
      setError(message);
      toastError(message);
      setLoading(false);
    }
  };

  const payDemo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/enrollments/checkout', {
        course_id: courseId,
        payment_method: 'card',
        card: {
          name: card.name.trim(),
          number: card.number.replace(/\s+/g, ''),
          expiry: card.expiry.trim(),
          cvc: card.cvc.trim(),
        },
      });
      success('Payment confirmed. You are enrolled.');
      navigate(learnPath(course), { state: { enrolled: true, payment: data.payment } });
    } catch (err) {
      const message = getError(err, 'Payment failed');
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!course) {
    return (
      <div className="page-shell">
        <Navbar />
        <div className="py-24 text-center text-fog">Loading checkout...</div>
      </div>
    );
  }

  const price = formatPrice(course.price, course.discount_price);

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-12 grid gap-8 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-7">
          <div className="section-kicker">Secure payment</div>
          <h1 className="font-display text-3xl font-extrabold mb-6">Checkout</h1>

          {banner && (
            <div className="mb-4 rounded-md border border-cyan/25 bg-cyan/10 px-4 py-3 text-sm text-ink">
              {banner}
            </div>
          )}

          <div className="rounded-md border border-line bg-gradient-to-r from-[#0b3d2e] to-[#0f6b4c] text-white px-4 py-4 mb-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Official gateway</div>
            <div className="mt-1 font-display text-2xl font-extrabold">Pay with EPS</div>
            <p className="mt-1 text-sm text-white/80">Visa, Mastercard, and mobile banking via Easy Payment System.</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-fog mb-4">
            <ShieldCheck size={14} className="text-cyan-deep" />
            You will be redirected to EPS to complete payment securely.
          </div>

          {error && <div className="text-sm text-coral mb-3">{error}</div>}

          <button
            type="button"
            disabled={loading}
            onClick={payEps}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? 'Redirecting to EPS...' : `Pay securely ${price.label}`}
          </button>

          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            className="mt-4 w-full text-xs font-semibold text-fog hover:text-ink"
          >
            {showDemo ? 'Hide demo card' : 'Use local demo card instead'}
          </button>

          {showDemo && (
            <form onSubmit={payDemo} className="space-y-4 mt-4 pt-4 border-t border-line">
              <div className="flex items-center gap-2 text-sm text-fog mb-1">
                <Lock size={14} className="text-cyan-deep" /> Encrypted demo payment terminal
              </div>

              <div className="rounded-md border border-cyan/25 bg-cyan/10 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-cyan-deep">Demo test card</div>
                  <button
                    type="button"
                    onClick={() => setCard({ ...DEMO_CARD })}
                    className="text-xs font-bold text-blue hover:underline"
                  >
                    Autofill
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink/80">
                  <div>Name: <span className="font-semibold">{DEMO_CARD.name}</span></div>
                  <div>Number: <span className="font-semibold">{DEMO_CARD.number}</span></div>
                  <div>Expiry: <span className="font-semibold">{DEMO_CARD.expiry}</span></div>
                  <div>CVC: <span className="font-semibold">{DEMO_CARD.cvc}</span></div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Name on card</span>
                <input
                  placeholder={DEMO_CARD.name}
                  value={card.name}
                  onChange={(e) => setCard({ ...card, name: e.target.value })}
                  className="input-field"
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Card number</span>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3.5 text-fog" size={16} />
                  <input
                    placeholder={DEMO_CARD.number}
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: e.target.value })}
                    className="input-field !pl-10"
                    inputMode="numeric"
                    required
                  />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Expiry</span>
                  <input
                    placeholder={DEMO_CARD.expiry}
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                    className="input-field"
                    required
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">CVC</span>
                  <input
                    placeholder={DEMO_CARD.cvc}
                    value={card.cvc}
                    onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                    className="input-field"
                    required
                  />
                </label>
              </div>
              <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? 'Processing...' : `Pay ${price.label} (demo)`}
              </button>
            </form>
          )}
        </div>

        <div className="rounded-lg border border-line bg-white p-7 h-fit">
          <img src={course.thumbnail_url} alt="" className="rounded-2xl aspect-video object-cover w-full mb-4" />
          <h2 className="font-display text-xl font-bold mb-4">{course.title}</h2>
          <div className="flex justify-between text-sm py-2.5 border-b border-line">
            <span className="text-fog">Subtotal</span>
            <span className="font-semibold">{price.label}</span>
          </div>
          <div className="flex justify-between text-sm py-2.5 border-b border-line">
            <span className="text-fog">Discount</span>
            <span className="font-semibold text-mint-deep">
              {price.original ? `−${formatMoney(price.original - price.current)}` : formatMoney(0)}
            </span>
          </div>
          <div className="flex justify-between font-extrabold text-lg py-4">
            <span>Total</span>
            <span className="text-aurora">{price.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
