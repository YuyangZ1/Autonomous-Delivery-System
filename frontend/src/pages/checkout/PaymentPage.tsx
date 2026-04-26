import { Alert, Button, Card, Spin, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { payOrder } from '../../api/client';

interface OrderDraft {
  orderId: string;
}

interface PlanChoice {
  vehicleType: string;
  priceUsd: number;
  etaMinutes: number;
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = loadJson<OrderDraft>('order_draft');
  const plan = loadJson<PlanChoice>('plan_choice');
  const orderId = searchParams.get('orderId') ?? draft?.orderId;

  if (!plan || !orderId) {
    return (
      <Card title="Payment">
        <Alert
          type="warning"
          showIcon
          message="Order information is incomplete. Please create a new order."
          style={{ marginBottom: 16 }}
        />
        <Button onClick={() => navigate('/order')}>Back to Create Order</Button>
      </Card>
    );
  }

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await payOrder(orderId, {
        vehicle_type: plan.vehicleType,
        price_usd: plan.priceUsd,
        eta_minutes: plan.etaMinutes,
      });
      navigate('/checkout/confirmation', {
        state: {
          orderId: result.order_id,
          handoffPin: result.handoff_pin,
          etaMinutes: result.eta_minutes,
          totalAmount: result.total_amount,
          vehicleType: result.vehicle_type,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Confirm Payment">
      <Typography.Paragraph>
        Delivery Method: {plan.vehicleType === 'DRONE' ? 'Drone' : 'Ground Robot'}
      </Typography.Paragraph>
      <Typography.Paragraph>
        Estimated Time: ~{plan.etaMinutes} minutes
      </Typography.Paragraph>
      <Typography.Title level={3} style={{ color: '#4F6EF7', marginBottom: 24 }}>
        Total: ${plan.priceUsd.toFixed(2)}
      </Typography.Title>
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}
      {loading ? (
        <Spin tip="Processing..." />
      ) : (
        <Button type="primary" size="large" onClick={() => void handlePay()}>
          Pay ${plan.priceUsd.toFixed(2)}
        </Button>
      )}
    </Card>
  );
}
