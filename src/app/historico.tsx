import { Tela, Vazio } from '@/components/tela';

export default function Historico() {
  return (
    <Tela titulo="Histórico">
      <Vazio
        mensagem="Sem sessões registradas ainda."
        acao="A evolução de carga aparece aqui depois do primeiro treino."
      />
    </Tela>
  );
}
