CREATE TABLE `exercicios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`grupo_muscular` text,
	`equipamento` text,
	`tipo_medicao` text NOT NULL,
	`incremento_g` integer,
	`incremento_placas` integer,
	`gramas_por_placa` integer,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	CONSTRAINT "ck_exercicios_tipo" CHECK("exercicios"."tipo_medicao" in ('carga_kg', 'carga_placa', 'peso_corporal', 'tempo', 'distancia')),
	CONSTRAINT "ck_exercicios_incremento" CHECK(("exercicios"."tipo_medicao" = 'carga_kg' and "exercicios"."incremento_g" > 0 and "exercicios"."incremento_placas" is null)
       or ("exercicios"."tipo_medicao" = 'carga_placa' and "exercicios"."incremento_placas" between 1 and 5 and "exercicios"."incremento_g" is null)
       or ("exercicios"."tipo_medicao" in ('peso_corporal', 'tempo', 'distancia') and "exercicios"."incremento_g" is null and "exercicios"."incremento_placas" is null)),
	CONSTRAINT "ck_exercicios_placa" CHECK("exercicios"."gramas_por_placa" is null or ("exercicios"."tipo_medicao" = 'carga_placa' and "exercicios"."gramas_por_placa" > 0))
);
--> statement-breakpoint
CREATE INDEX `idx_exercicios_nome` ON `exercicios` (`nome`);--> statement-breakpoint
CREATE TABLE `medidas` (
	`id` text PRIMARY KEY NOT NULL,
	`parte` text NOT NULL,
	`valor_mm` integer NOT NULL,
	`medido_em` integer NOT NULL,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	CONSTRAINT "ck_medidas_valor" CHECK("medidas"."valor_mm" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_medidas_parte` ON `medidas` (`parte`,`medido_em`);--> statement-breakpoint
CREATE TABLE `perfil` (
	`id` text PRIMARY KEY DEFAULT 'unico' NOT NULL,
	`altura_mm` integer,
	`peso_objetivo_g` integer,
	`peso_inicial_g` integer,
	`objetivo_definido_em` integer,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	CONSTRAINT "ck_perfil_linha_unica" CHECK("perfil"."id" = 'unico'),
	CONSTRAINT "ck_perfil_valores" CHECK(("perfil"."altura_mm" is null or "perfil"."altura_mm" between 1000 and 2500)
      and ("perfil"."peso_objetivo_g" is null or "perfil"."peso_objetivo_g" > 0)
      and ("perfil"."peso_inicial_g" is null or "perfil"."peso_inicial_g" > 0))
);
--> statement-breakpoint
CREATE TABLE `pesagens` (
	`id` text PRIMARY KEY NOT NULL,
	`peso_g` integer NOT NULL,
	`medido_em` integer NOT NULL,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	CONSTRAINT "ck_pesagens_peso" CHECK("pesagens"."peso_g" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_pesagens_medido` ON `pesagens` (`medido_em`);--> statement-breakpoint
CREATE TABLE `preferencias` (
	`chave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL,
	`atualizado_em` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`sessao_id` text NOT NULL,
	`exercicio_id` text NOT NULL,
	`indice` integer NOT NULL,
	`tipo` text DEFAULT 'valida' NOT NULL,
	`carga_g` integer,
	`carga_placas` integer,
	`repeticoes` integer,
	`duracao_s` integer,
	`rir` integer,
	`concluida_em` integer NOT NULL,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	FOREIGN KEY (`sessao_id`) REFERENCES `sessoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercicio_id`) REFERENCES `exercicios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_series_uma_unidade" CHECK("series"."carga_g" is null or "series"."carga_placas" is null),
	CONSTRAINT "ck_series_carga_positiva" CHECK(("series"."carga_g" is null or "series"."carga_g" > 0) and ("series"."carga_placas" is null or "series"."carga_placas" > 0)),
	CONSTRAINT "ck_series_tipo" CHECK("series"."tipo" in ('aquecimento', 'valida', 'falha')),
	CONSTRAINT "ck_series_rir" CHECK("series"."rir" is null or ("series"."rir" between 0 and 5)),
	CONSTRAINT "ck_series_reps" CHECK("series"."repeticoes" is null or "series"."repeticoes" > 0),
	CONSTRAINT "ck_series_duracao" CHECK("series"."duracao_s" is null or "series"."duracao_s" > 0),
	CONSTRAINT "ck_series_indice" CHECK("series"."indice" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_series_sessao_exercicio_indice` ON `series` (`sessao_id`,`exercicio_id`,`indice`);--> statement-breakpoint
CREATE INDEX `idx_series_exercicio` ON `series` (`exercicio_id`,`concluida_em`);--> statement-breakpoint
CREATE TABLE `sessoes` (
	`id` text PRIMARY KEY NOT NULL,
	`treino_id` text,
	`nome` text NOT NULL,
	`iniciada_em` integer NOT NULL,
	`finalizada_em` integer,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	FOREIGN KEY (`treino_id`) REFERENCES `treinos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_sessoes_intervalo" CHECK("sessoes"."finalizada_em" is null or "sessoes"."finalizada_em" >= "sessoes"."iniciada_em")
);
--> statement-breakpoint
CREATE INDEX `idx_sessoes_iniciada` ON `sessoes` (`iniciada_em`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sessao_aberta` ON `sessoes` (1) WHERE "sessoes"."finalizada_em" is null and "sessoes"."arquivado_em" is null;--> statement-breakpoint
CREATE TABLE `treino_exercicios` (
	`id` text PRIMARY KEY NOT NULL,
	`treino_id` text NOT NULL,
	`exercicio_id` text NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`series_alvo` integer DEFAULT 3 NOT NULL,
	`reps_alvo_min` integer,
	`reps_alvo_max` integer,
	`carga_alvo_g` integer,
	`carga_alvo_placas` integer,
	`duracao_alvo_s` integer,
	`descanso_s` integer DEFAULT 90 NOT NULL,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	FOREIGN KEY (`treino_id`) REFERENCES `treinos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercicio_id`) REFERENCES `exercicios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ck_te_uma_unidade" CHECK("treino_exercicios"."carga_alvo_g" is null or "treino_exercicios"."carga_alvo_placas" is null),
	CONSTRAINT "ck_te_carga_positiva" CHECK(("treino_exercicios"."carga_alvo_g" is null or "treino_exercicios"."carga_alvo_g" > 0) and ("treino_exercicios"."carga_alvo_placas" is null or "treino_exercicios"."carga_alvo_placas" > 0)),
	CONSTRAINT "ck_te_series_alvo" CHECK("treino_exercicios"."series_alvo" > 0),
	CONSTRAINT "ck_te_reps_faixa" CHECK("treino_exercicios"."reps_alvo_min" is null or "treino_exercicios"."reps_alvo_max" is null or "treino_exercicios"."reps_alvo_max" >= "treino_exercicios"."reps_alvo_min"),
	CONSTRAINT "ck_te_duracao" CHECK("treino_exercicios"."duracao_alvo_s" is null or "treino_exercicios"."duracao_alvo_s" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_treino_exercicios_treino` ON `treino_exercicios` (`treino_id`,`ordem`);--> statement-breakpoint
CREATE TABLE `treinos` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`descricao` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer
);
