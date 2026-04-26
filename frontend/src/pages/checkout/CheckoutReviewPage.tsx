import { Alert, Button, Card, Descriptions, Space, Typography } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface OrderDraft {
  orderId: string;
  pickupAddress: string;
  dropoffAddress: string;
  parcel: { sizeTier: string; weightKg: number; fragile: boolean };
}

interface PlanChoice {
  vehicleType: string;
  priceUsd: number;
  etaMinutes: number;
}

function loadDraft(): OrderDraft | null {
  try {
    const raw = sessionStorage.getItem('order_draft');
    return raw ? (JSON.parse(raw) as OrderDraft) : null;
  } catch {
    return null;
  }
}

function loadPlanChoice(): PlanChoice | null {
  try {
    const raw = sessionStorage.getItem('plan_choice');
    return raw ? (JSON.parse(raw) as PlanChoice) : null;
  } catch {
    return null;
  }
}

export function CheckoutReviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const draft = loadDraft();
  const plan = loadPlanChoice();
  const orderId = searchParams.get('orderId') ?? draft?.orderId;

  if (!draft || !plan || !orderId) {
    return (
      <Card title="Order Summary">
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

  const vehicleLabel = plan.vehicleType === 'DRONE' ? 'Drone' : 'Ground Robot';

  return (
    <Card title="Order Summary">
      <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Pickup Address">{draft.pickupAddress}</Descriptions.Item>
        <Descriptions.Item label="Dropoff Address">{draft.dropoffAddress}</Descriptions.Item>
        <Descriptions.Item label="Package Specs">
          {draft.parcel.sizeTier} · {draft.parcel.weightKg} kg
          {draft.parcel.fragile ? ' · Fragile' : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Delivery Method">{vehicleLabel}</Descriptions.Item>
        <Descriptions.Item label="Estimated Time">~{plan.etaMinutes} minutes</Descriptions.Item>
        <Descriptions.Item label="Delivery Fee">
          <Typography.Text strong style={{ fontSize: 18, color: '#4F6EF7' }}>
            ${plan.priceUsd.toFixed(2)}
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>
      <Space wrap>
        <Button onClick={() => navigate('/order')}>Back to Edit</Button>
        <Button
          type="primary"
          onClick={() => navigate(`/checkout/pay?orderId=${encodeURIComponent(orderId)}`)}
        >
          Pay ${plan.priceUsd.toFixed(2)}
        </Button>
      </Space>
    </Card>
  );
}
