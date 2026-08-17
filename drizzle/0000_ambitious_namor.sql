CREATE TABLE `exercicios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`grupo_muscular` text,
	`equipamento` text,
	`tipo_medicao` text DEFAULT 'carga_reps' NOT NULL,
	`incremento_g` integer DEFAULT 2500 NOT NULL,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer
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
	`arquivado_em` integer
);
--> statement-breakpoint
CREATE INDEX `idx_medidas_parte` ON `medidas` (`parte`,`medido_em`);--> statement-breakpoint
CREATE TABLE `pesagens` (
	`id` text PRIMARY KEY NOT NULL,
	`peso_g` integer NOT NULL,
	`medido_em` integer NOT NULL,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer
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
	`repeticoes` integer,
	`duracao_s` integer,
	`rir` integer,
	`concluida_em` integer NOT NULL,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	FOREIGN KEY (`sessao_id`) REFERENCES `sessoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercicio_id`) REFERENCES `exercicios`(`id`) ON UPDATE no action ON DELETE no action
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
	FOREIGN KEY (`treino_id`) REFERENCES `treinos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessoes_iniciada` ON `sessoes` (`iniciada_em`);--> statement-breakpoint
CREATE TABLE `treino_exercicios` (
	`id` text PRIMARY KEY NOT NULL,
	`treino_id` text NOT NULL,
	`exercicio_id` text NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	`series_alvo` integer DEFAULT 3 NOT NULL,
	`reps_alvo_min` integer,
	`reps_alvo_max` integer,
	`descanso_s` integer DEFAULT 90 NOT NULL,
	`observacao` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	`arquivado_em` integer,
	FOREIGN KEY (`treino_id`) REFERENCES `treinos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercicio_id`) REFERENCES `exercicios`(`id`) ON UPDATE no action ON DELETE no action
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
