import { Html, Head, Preview, Body, Container, Text, Button, Link } from '@react-email/components';

interface TrialExpiredProps {
  userName: string;
  tenantName: string;
  siteUrl: string;
}

export default function TrialExpiredEmail({ userName, tenantName, siteUrl }: TrialExpiredProps) {
  const plansUrl = `${siteUrl}/subscription/plans`;
  return (
    <Html>
      <Head />
      <Preview>Tu período de prueba ha terminado</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1a1a1a' }}>
            Tu período de prueba ha terminado
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>
            Hola {userName},
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Tu período de prueba para <strong>{tenantName}</strong> ha finalizado. Para seguir utilizando Shopify Sync y todas sus funcionalidades, activa tu suscripción.
          </Text>
          <Button href={plansUrl} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none' }}>
            Activa tu suscripción
          </Button>
          <Text style={{ fontSize: '14px', marginTop: '24px', color: '#666' }}>
            Si no activas tu plan, las conexiones de tus tiendas quedarán pausadas.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}