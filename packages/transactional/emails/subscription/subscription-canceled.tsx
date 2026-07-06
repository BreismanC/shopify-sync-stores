import { Html, Head, Preview, Body, Container, Text, Link } from '@react-email/components';

interface SubscriptionCanceledProps {
  userName: string;
  canceledDate: Date;
  feedbackLink: string;
  siteUrl: string;
}

export default function SubscriptionCanceledEmail({ userName, canceledDate, feedbackLink, siteUrl }: SubscriptionCanceledProps) {
  const formattedDate = new Date(canceledDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <Html>
      <Head />
      <Preview>Tu suscripción ha sido cancelada</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1a1a1a' }}>
            Tu suscripción ha sido cancelada
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>
            Hola {userName},
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Tu suscripción fue cancelada el <strong>{formattedDate}</strong>. Sentimos verte partir.
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Tus datos serán conservados por 90 días. Si deseas reactivar tu cuenta en el futuro, puedes hacerlo en cualquier momento.
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '24px' }}>
            Nos encantaría saber por qué cancelaste. Tu retroalimentación nos ayuda a mejorar:
          </Text>
          <Link href={feedbackLink} style={{ fontSize: '16px', color: '#2563eb', textDecoration: 'underline' }}>
            Completar encuesta de salida
          </Link>
          <Text style={{ fontSize: '14px', marginTop: '24px', color: '#666' }}>
            Gracias por haber sido parte de Shopify Sync. Te deseamos mucho éxito en tu negocio.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}