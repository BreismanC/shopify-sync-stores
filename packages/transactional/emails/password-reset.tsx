import { Html, Head, Preview, Body, Container, Text, Button, Link } from '@react-email/components';

export default function PasswordResetEmail({ resetLink }: { resetLink: string }) {
  return (
    <Html>
      <Head />
      <Preview>Recupera tu contraseña</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>Hola,</Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Solicitaste recuperar tu contraseña. Haz clic en el botón de abajo para continuar:
          </Text>
          <Button href={resetLink} style={{ backgroundColor: '#2563eb', color: '#ffffff', textDecoration: 'none' }}>
            Resetear contraseña
          </Button>
          <Text style={{ fontSize: '14px', marginTop: '20px', marginBottom: '8px' }}>
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </Text>
          <Text style={{ fontSize: '14px', wordBreak: 'break-all' }}>
            <Link href={resetLink}>{resetLink}</Link>
          </Text>
          <Text style={{ fontSize: '14px', marginTop: '20px' }}>
            Si no solicitaste esto, ignora este correo.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
