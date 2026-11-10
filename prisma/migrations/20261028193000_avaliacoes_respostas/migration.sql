BEGIN;
-- DropIndex
DROP INDEX "resposta_tentativa_id_aluno_id_avaliacao_id_key";

-- AlterTable
ALTER TABLE "resposta" ADD COLUMN     "comentario_correcao" TEXT,
ADD COLUMN     "pontuacao_obtida" DECIMAL(10,2);

ALTER TABLE "resposta" ADD CONSTRAINT "resposta_pontuacao_nao_negativa" CHECK (pontuacao_obtida IS NULL OR pontuacao_obtida >= 0);
COMMIT;
