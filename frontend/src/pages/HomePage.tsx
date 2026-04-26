import { Button, Card, Col, Row, Typography } from 'antd';
import {
  RocketOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

const features = [
  {
    icon: <RocketOutlined style={{ fontSize: 24, color: '#4F6EF7' }} />,
    title: 'Lightning-Fast Delivery',
    desc: 'Autonomous robots & drones deliver in as little as 28 minutes',
  },
  {
    icon: <EnvironmentOutlined style={{ fontSize: 24, color: '#10B981' }} />,
    title: 'Full Visibility',
    desc: 'Real-time tracking of your delivery location and order status',
  },
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#F59E0B' }} />,
    title: 'Secure & Safe',
    desc: 'End-to-end encrypted delivery with complete package safety',
  },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero Section */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4F6EF7 0%, #3B5BDB 100%)',
          borderRadius: 16,
          padding: '48px 40px',
          marginBottom: 32,
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            right: 80,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />

        <Title
          level={1}
          style={{
            color: '#fff',
            margin: '0 0 12px',
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          Intelligent Autonomous Delivery
        </Title>
        <Paragraph
          style={{
            color: 'rgba(255,255,255,0.80)',
            fontSize: 16,
            marginBottom: 32,
            maxWidth: 480,
          }}
        >
          Fast, safe, and carbon-neutral package delivery powered by autonomous robots and drones.
        </Paragraph>
        <Button
          type="default"
          size="large"
          icon={<ArrowRightOutlined />}
          iconPosition="end"
          onClick={() => navigate('/order')}
          style={{
            background: '#fff',
            color: '#4F6EF7',
            border: 'none',
            fontWeight: 600,
            borderRadius: 10,
            height: 44,
            paddingInline: 24,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}
        >
          Create Order
        </Button>
      </div>

      {/* Feature Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {features.map((f) => (
          <Col xs={24} sm={8} key={f.title}>
            <Card
              style={{ height: '100%' }}
              styles={{ body: { padding: '24px' } }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: '#F4F6FD',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                {f.icon}
              </div>
              <Title level={5} style={{ margin: '0 0 6px', color: '#1A1D2E' }}>
                {f.title}
              </Title>
              <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {f.desc}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Quick links */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card
            hoverable
            onClick={() => navigate('/history')}
            style={{ cursor: 'pointer' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Title level={5} style={{ margin: '0 0 4px', color: '#1A1D2E' }}>
                  Order History
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  View all delivery history
                </Text>
              </div>
              <ArrowRightOutlined style={{ color: '#6B7280', fontSize: 16 }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            hoverable
            onClick={() => navigate('/profile')}
            style={{ cursor: 'pointer' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Title level={5} style={{ margin: '0 0 4px', color: '#1A1D2E' }}>
                  Profile
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Manage your account and preferences
                </Text>
              </div>
              <ArrowRightOutlined style={{ color: '#6B7280', fontSize: 16 }} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
