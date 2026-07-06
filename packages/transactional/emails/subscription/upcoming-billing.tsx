import { Html, Head, Preview, Body, Container, Text } from '@react-email/components';

interface UpcomingBillingProps {
  userName: string;
  amount: number;
  nextBillingDate: Date;
  planName: string;
  siteUrl: string;
}

export default function UpcomingBillingEmail({ userName, amount, nextBillingDate, planName, siteUrl }: UpcomingBillingProps) {
  const formattedDate = new Date(nextBillingDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <Html>
      <Head />
      <Preview>Próximo cobro en 3 días</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1a1a1a' }}>
            Próximo cobro en 3 días
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>
            Hola {userName},
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Te notificamos que se realizará un cobro automático en tu suscripción <strong>{planName}</strong>:
          </Text>
          <Container style={{ backgroundColor: '#f4f4f7', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <Text style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Monto:</strong> ${amount}</Text>
            <Text style={{ fontSize: '14px' }}><strong>Fecha:</strong> {formattedDate}</Text>
          </Container>
          <Text style={{ fontSize: '14px', color: '#666' }}>
            Si deseas modificar tu método de pago o cancelar, puedes hacerlo desde tu panel de suscripción.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}