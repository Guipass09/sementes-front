import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const contactEmail = "sementesdafala@gmail.com";

export function LandingPolicies() {
  return (
    <div className="lp-footer__policies">
      <Dialog>
        <DialogTrigger asChild><button type="button">Termos de Uso</button></DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Termos de Uso</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            <p>Bem-vindo(a) à plataforma <strong>Sementes da Fala</strong>. Ao acessar ou utilizar nossos serviços, você concorda com os presentes Termos de Uso. Caso não concorde com qualquer condição aqui descrita, recomendamos que não utilize a plataforma.</p>
            <section><h3 className="font-bold">1. Objetivo da plataforma</h3><p>A plataforma Sementes da Fala tem como objetivo oferecer conteúdos educativos, atividades terapêuticas, materiais digitais e, quando contratado, atendimentos online voltados ao desenvolvimento da fala, linguagem e aprendizagem.</p><p>Os conteúdos disponibilizados não substituem avaliação ou acompanhamento presencial com profissional de saúde, quando necessário.</p></section>
            <section><h3 className="font-bold">2. Cadastro e acesso</h3><p>Para utilizar determinadas funcionalidades, o usuário poderá precisar criar uma conta, fornecendo informações verdadeiras e atualizadas. O usuário é responsável por manter a confidencialidade de seus dados de acesso.</p></section>
            <section><h3 className="font-bold">3. Uso adequado da plataforma</h3><p>Ao utilizar a plataforma, o usuário compromete-se a:</p><ul className="list-disc pl-6"><li>Utilizar os conteúdos apenas para fins pessoais e educativos;</li><li>Não copiar, reproduzir, distribuir ou comercializar materiais sem autorização;</li><li>Não utilizar a plataforma para fins ilegais, ofensivos ou que violem direitos de terceiros.</li></ul></section>
            <section><h3 className="font-bold">4. Propriedade intelectual</h3><p>Todo o conteúdo disponível (textos, vídeos, imagens, atividades, logotipo, marca, layout e materiais pedagógicos) é protegido por direitos autorais e pertence à Sementes da Fala, sendo proibida sua reprodução sem autorização prévia.</p></section>
            <section><h3 className="font-bold">5. Atendimentos online</h3><p>Os atendimentos realizados têm caráter educativo e terapêutico, respeitando os limites éticos da profissão. Eles não substituem avaliação médica ou psicológica presencial, quando necessária.</p></section>
            <section><h3 className="font-bold">6. Alterações nos termos</h3><p>A plataforma poderá atualizar estes Termos de Uso a qualquer momento. Recomenda-se a leitura periódica para se manter informado.</p></section>
            <section><h3 className="font-bold">7. Contato</h3><p>Em caso de dúvidas, entre em contato pelo e-mail: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p></section>
            <p>Ao utilizar a plataforma, você declara estar de acordo com estes Termos de Uso.</p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild><button type="button">Política de Privacidade</button></DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Política de Privacidade</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            <p>A Sementes da Fala valoriza a sua privacidade e está comprometida com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).</p>
            <section><h3 className="font-bold">1. Dados coletados</h3><p>Podemos coletar as seguintes informações:</p><ul className="list-disc pl-6"><li>Nome, e-mail e dados de cadastro;</li><li>Informações fornecidas voluntariamente em formulários;</li><li>Dados de navegação (cookies, IP, tipo de dispositivo);</li><li>Informações necessárias para agendamento ou acesso a conteúdos.</li></ul></section>
            <section><h3 className="font-bold">2. Finalidade do uso dos dados</h3><p>Os dados coletados são utilizados para:</p><ul className="list-disc pl-6"><li>Gerenciar o acesso à plataforma;</li><li>Oferecer conteúdos personalizados;</li><li>Realizar atendimentos online;</li><li>Enviar comunicações importantes e informativas;</li><li>Melhorar a experiência do usuário.</li></ul></section>
            <section><h3 className="font-bold">3. Compartilhamento de dados</h3><p>Seus dados não são vendidos ou compartilhados com terceiros, exceto quando necessário para:</p><ul className="list-disc pl-6"><li>Cumprimento de obrigações legais;</li><li>Processamento técnico da plataforma (hospedagem, pagamentos, segurança).</li></ul></section>
            <section><h3 className="font-bold">4. Armazenamento e segurança</h3><p>Utilizamos medidas técnicas e organizacionais para proteger seus dados contra acessos não autorizados, vazamentos ou uso indevido.</p></section>
            <section><h3 className="font-bold">5. Direitos do usuário</h3><p>Você pode, a qualquer momento:</p><ul className="list-disc pl-6"><li>Solicitar acesso aos seus dados;</li><li>Corrigir informações;</li><li>Solicitar exclusão de dados (quando permitido por lei);</li><li>Revogar consentimentos.</li></ul><p>Para isso, entre em contato pelo e-mail: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p></section>
            <section><h3 className="font-bold">6. Alterações na política</h3><p>Esta Política de Privacidade pode ser atualizada a qualquer momento. Recomendamos a consulta periódica.</p></section>
            <p>Ao utilizar a plataforma, você concorda com esta Política de Privacidade.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
