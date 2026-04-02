# DDL do Banco Antigo

```sql
CREATE TABLE `addresses` (
  `id` varchar(36) NOT NULL,
  `numero` varchar(20) NOT NULL,
  `logradouro` varchar(255) DEFAULT NULL,
  `bairro` varchar(255) DEFAULT NULL,
  `cidade` varchar(255) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `ativo` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `list_id` varchar(36) DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `cep` varchar(9) NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `analisado` varchar(255) NOT NULL DEFAULT 'pending',
  `idAlertAirb` varchar(255) NOT NULL DEFAULT 'no_id',
  PRIMARY KEY (`id`),
  KEY `IDX_645885a28d9d34ba539fdda6a8` (`cidade`),
  KEY `IDX_41aa769237c813f7ffebd0b26c` (`cep`),
  KEY `IDX_ef4dab2d4e8cbfa5b9067c275d` (`list_id`,`user_id`),
  KEY `FK_16aac8a9f6f9c1dd6bcb75ec023` (`user_id`),
  CONSTRAINT `FK_16aac8a9f6f9c1dd6bcb75ec023` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
  CONSTRAINT `FK_7680f3c6138b45c8f793258820b` FOREIGN KEY (`list_id`) REFERENCES `list` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `analise_endereco_evento` (
  `id` varchar(36) NOT NULL,
  `distancia_metros` int NOT NULL,
  `criado_em` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `atualizado_em` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `evento_id` varchar(36) NOT NULL,
  `endereco_id` varchar(36) NOT NULL,
  `usuario_proprietario_id` varchar(36) NOT NULL,
  `duracao_minutos` int NOT NULL,
  `transport_mode` varchar(50) NOT NULL,
  `enviado` tinyint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_ad8af3fbf1b0c92ae855c42ae4` (`evento_id`,`endereco_id`,`usuario_proprietario_id`),
  KEY `FK_55e001f245eefed8c406e4760cc` (`usuario_proprietario_id`),
  KEY `FK_b23c341d8169359cffa4a12cf1e` (`endereco_id`),
  CONSTRAINT `FK_55e001f245eefed8c406e4760cc` FOREIGN KEY (`usuario_proprietario_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_b23c341d8169359cffa4a12cf1e` FOREIGN KEY (`endereco_id`) REFERENCES `addresses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_fa0bdd6f64a30fff722816aec85` FOREIGN KEY (`evento_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `analise_preco` (
  `id` varchar(36) NOT NULL,
  `distancia_sua_propriedade` float NOT NULL,
  `distancia_propriedade_referencia` float NOT NULL,
  `preco_sugerido` decimal(10,2) NOT NULL,
  `seu_preco_atual` decimal(10,2) NOT NULL,
  `diferenca_percentual` decimal(5,2) NOT NULL,
  `recomendacao` varchar(255) NOT NULL,
  `criado_em` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `endereco_id` varchar(36) NOT NULL,
  `evento_id` varchar(36) NOT NULL,
  `usuario_proprietario_id` varchar(36) NOT NULL,
  `aceito` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `FK_4ed2f899f51045514270b4f41df` (`endereco_id`),
  KEY `FK_a434e6fd22a6d010eded859f735` (`evento_id`),
  KEY `FK_8c79ec3e52d989c410e0fe6fc2b` (`usuario_proprietario_id`),
  CONSTRAINT `FK_4ed2f899f51045514270b4f41df` FOREIGN KEY (`endereco_id`) REFERENCES `addresses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_8c79ec3e52d989c410e0fe6fc2b` FOREIGN KEY (`usuario_proprietario_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_a434e6fd22a6d010eded859f735` FOREIGN KEY (`evento_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `email_confirmations` (
  `id` varchar(36) NOT NULL,
  `code` varchar(255) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `confirmed` tinyint NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `userId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_930e1d7c0171d23e5535b1e3873` (`userId`),
  CONSTRAINT `FK_930e1d7c0171d23e5535b1e3873` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `email_tokens` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `usedAt` datetime DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_3c9d0517a29ae032a37e258d51` (`tokenHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `events` (
  `id` varchar(36) NOT NULL,
  `descricao` text,
  `estado` varchar(2) NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `ativo` tinyint NOT NULL DEFAULT '1',
  `nome` varchar(255) NOT NULL,
  `cidade` varchar(255) NOT NULL,
  `dataInicio` datetime NOT NULL,
  `dataFim` datetime NOT NULL,
  `enderecoCompleto` text NOT NULL,
  `linkSiteOficial` text,
  `categoria` varchar(100) DEFAULT NULL,
  `dataCrawl` datetime DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `imagem_url` text,
  PRIMARY KEY (`id`),
  KEY `IDX_67108534254a58377f0b6b8fe8` (`nome`),
  KEY `IDX_da09dd22804c5ab5d5c193df44` (`cidade`),
  KEY `IDX_f002d2d980327cc1c4c4e368f6` (`latitude`),
  KEY `IDX_2842db70f335693a76e656ae0d` (`longitude`),
  KEY `IDX_e50b15278a3b66d693d8dad0f6` (`dataInicio`),
  KEY `IDX_09d898cc65715a8b22d7097cf1` (`dataFim`),
  KEY `IDX_04c6ba002d34db794ef453aadd` (`estado`),
  KEY `IDX_204faf0c2a181c459e7ce9f4c5` (`categoria`),
  KEY `IDX_f0cd9c1f64dd1484474fd9ed61` (`dataCrawl`),
  KEY `IDX_15acf739592c0f48f7056735aa` (`dataInicio`,`dataFim`),
  KEY `IDX_3a56c148d67440d4a749a384e5` (`cidade`,`estado`),
  KEY `IDX_58095308749008e0a54eabf0ff` (`latitude`,`longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `events_backup` (
  `id` varchar(36) NOT NULL,
  `descricao` text,
  `estado` varchar(2) NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `ativo` tinyint NOT NULL DEFAULT '1',
  `nome` varchar(255) NOT NULL,
  `cidade` varchar(255) NOT NULL,
  `dataInicio` datetime NOT NULL,
  `dataFim` datetime NOT NULL,
  `enderecoCompleto` text NOT NULL,
  `linkSiteOficial` text,
  `categoria` varchar(100) DEFAULT NULL,
  `dataCrawl` datetime DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `imagem_url` text,
  PRIMARY KEY (`id`),
  KEY `IDX_67108534254a58377f0b6b8fe8` (`nome`),
  KEY `IDX_da09dd22804c5ab5d5c193df44` (`cidade`),
  KEY `IDX_f002d2d980327cc1c4c4e368f6` (`latitude`),
  KEY `IDX_2842db70f335693a76e656ae0d` (`longitude`),
  KEY `IDX_e50b15278a3b66d693d8dad0f6` (`dataInicio`),
  KEY `IDX_09d898cc65715a8b22d7097cf1` (`dataFim`),
  KEY `IDX_04c6ba002d34db794ef453aadd` (`estado`),
  KEY `IDX_204faf0c2a181c459e7ce9f4c5` (`categoria`),
  KEY `IDX_f0cd9c1f64dd1484474fd9ed61` (`dataCrawl`),
  KEY `IDX_15acf739592c0f48f7056735aa` (`dataInicio`,`dataFim`),
  KEY `IDX_3a56c148d67440d4a749a384e5` (`cidade`,`estado`),
  KEY `IDX_58095308749008e0a54eabf0ff` (`latitude`,`longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `list` (
  `id` varchar(36) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `id_do_anuncio` varchar(255) NOT NULL,
  `ativo` tinyint NOT NULL DEFAULT '1',
  `user_id` varchar(36) DEFAULT NULL,
  `picture_url` varchar(255) DEFAULT NULL,
  `priceText` varchar(255) DEFAULT NULL,
  `raw` float DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `checkIn` date DEFAULT NULL,
  `checkOut` date DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `dailyPrice` float DEFAULT NULL,
  `hospedes` int DEFAULT NULL,
  `quartos` int DEFAULT NULL,
  `camas` int DEFAULT NULL,
  `banheiros` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_a842f768ec87a346b0ee61fabba` (`user_id`),
  CONSTRAINT `FK_a842f768ec87a346b0ee61fabba` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `title_button` varchar(255) DEFAULT NULL,
  `redirect_to` varchar(255) DEFAULT NULL,
  `sent` tinyint NOT NULL DEFAULT '0',
  `opened` tinyint NOT NULL DEFAULT '0',
  `send_email` tinyint NOT NULL DEFAULT '0',
  `user_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_9a8a82462cab47c73d25f49261f` (`user_id`),
  CONSTRAINT `FK_9a8a82462cab47c73d25f49261f` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `payment` (
  `id` varchar(36) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `expireDate` timestamp NULL DEFAULT NULL,
  `startDate` timestamp NULL DEFAULT NULL,
  `customerId` varchar(255) DEFAULT NULL,
  `subscriptionId` varchar(255) DEFAULT NULL,
  `mode` varchar(50) DEFAULT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_c66c60a17b56ec882fcd8ec770b` (`user_id`),
  CONSTRAINT `FK_c66c60a17b56ec882fcd8ec770b` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `percentuais` (
  `id` varchar(36) NOT NULL,
  `percentual_inicial` double NOT NULL,
  `percentual_final` double NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `REL_88f77c0ad0d5375cba92a6022f` (`user_id`),
  CONSTRAINT `FK_88f77c0ad0d5375cba92a6022f0` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `price_suggestions` (
  `id` varchar(36) NOT NULL,
  `preco` decimal(10,2) NOT NULL,
  `cancelado` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `user_id` varchar(36) DEFAULT NULL,
  `analise_id` varchar(36) DEFAULT NULL,
  `address_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `REL_22db280eecaa108146537b210c` (`analise_id`),
  KEY `FK_8110f057b9dc2ace5f98e56b73d` (`user_id`),
  KEY `FK_8c92390f949e747e592b0b60ea0` (`address_id`),
  CONSTRAINT `FK_22db280eecaa108146537b210ca` FOREIGN KEY (`analise_id`) REFERENCES `analise_preco` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_8110f057b9dc2ace5f98e56b73d` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_8c92390f949e747e592b0b60ea0` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `process_status` (
  `id` varchar(36) NOT NULL,
  `status` enum('running','completed','error') NOT NULL DEFAULT 'running',
  `errorMessage` text,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `typeorm_metadata` (
  `type` varchar(255) NOT NULL,
  `database` varchar(255) DEFAULT NULL,
  `schema` varchar(255) DEFAULT NULL,
  `table` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `value` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE `user` (
  `id` varchar(36) NOT NULL,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `distance_km` double DEFAULT '30',
  `ativo` tinyint NOT NULL DEFAULT '0',
  `phone` varchar(255) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_e12875dfb3b1d92d7d7c5377e2` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

