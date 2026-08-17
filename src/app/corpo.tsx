import { Tela, Vazio } from '@/components/tela';

export default function Corpo() {
  return (
    <Tela titulo="Corpo">
      <Vazio
        mensagem="Nenhuma pesagem ou medida registrada."
        acao="Peso e medidas ficam aqui, com média de 7 dias."
      />
    </Tela>
  );
}
