import { Html, Head, Preview, Body, Container, Text } from '@react-email/components';

interface PaymentSuccessProps {
  userName: string;
  amount: number;
  planName: string;
  nextBillingDate: Date;
  billingPeriod: string;
  siteUrl: string;
}

export default function PaymentSuccessEmail({ userName, amount, planName, nextBillingDate, billingPeriod, siteUrl }: PaymentSuccessProps) {
  const formattedDate = new Date(nextBillingDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <Html>
      <Head />
      <Preview>Pago confirmado</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1a1a1a' }}>
            ✓ Pago confirmado
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>
            Hola {userName},
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Tu pago ha sido procesado correctamente:
          </Text>
          <Container style={{ backgroundColor: '#f4f4f7', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <Text style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Plan:</strong> {planName}</Text>
            <Text style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Monto:</strong> ${amount}</Text>
            <Text style={{ fontSize: '14px', marginBottom: '8px' }}><strong>Período:</strong> {billingPeriod}</Text>
            <Text style={{ fontSize: '14px' }}><strong>Próximo cobro:</strong> {formattedDate}</Text>
          </Container>
          <Text style={{ fontSize: '14px', color: '#666' }}>
            Puedes ver los detalles de tu suscripción en cualquier momento desde tu panel de cuenta.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}