import { Html, Head, Preview, Body, Container, Text, Button, Link } from '@react-email/components';

interface TrialExpiringProps {
  userName: string;
  daysLeft: number;
  planName: string;
  siteUrl: string;
}

export default function TrialExpiringEmail({ userName, daysLeft, planName, siteUrl }: TrialExpiringProps) {
  const plansUrl = `${siteUrl}/subscription/plans`;
  return (
    <Html>
      <Head />
      <Preview>Tu período de prueba está por terminar</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1a1a1a' }}>
            ¡Tu período de prueba está por terminar!
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>
            Hola {userName},
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Tu período de prueba de <strong>{planName}</strong> expirará en <strong>{daysLeft} días</strong>. Para no perder el acceso a tus tiendas y conexiones, elige tu plan ahora.
          </Text>
          <Button href={plansUrl} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none' }}>
            Elige tu plan ahora
          </Button>
          <Text style={{ fontSize: '14px', marginTop: '24px', color: '#666' }}>
            Si no eliges un plan, tu cuenta quedará limitada al finalizar el trial.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}