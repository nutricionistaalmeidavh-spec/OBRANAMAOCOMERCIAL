-- Catálogo comercial aprovado: Essencial, Pro e Empresa.
-- Valores armazenados em centavos; anual equivale a 10 mensalidades.

INSERT OR REPLACE INTO billing_plan_versions(
  id,plan_code,version,name,price_cents,currency,interval_code,
  modules_json,channels_json,max_users,max_projects,max_devices,active,created_at
) VALUES
('catalog_essencial_monthly_v1','essencial_monthly',1,'Essencial',14900,'BRL','monthly','["obra360","rdo","documents","universidade"]','["desktop","mobile"]',5,3,2,1,CURRENT_TIMESTAMP),
('catalog_essencial_yearly_v1','essencial_yearly',1,'Essencial',149000,'BRL','yearly','["obra360","rdo","documents","universidade"]','["desktop","mobile"]',5,3,2,1,CURRENT_TIMESTAMP),
('catalog_pro_monthly_v1','pro_monthly',1,'Pro',29900,'BRL','monthly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',20,10,5,1,CURRENT_TIMESTAMP),
('catalog_pro_yearly_v1','pro_yearly',1,'Pro',299000,'BRL','yearly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',20,10,5,1,CURRENT_TIMESTAMP),
('catalog_empresa_monthly_v1','empresa_monthly',1,'Empresa',49900,'BRL','monthly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',60,30,15,1,CURRENT_TIMESTAMP),
('catalog_empresa_yearly_v1','empresa_yearly',1,'Empresa',499000,'BRL','yearly','["finance","rh","contracts","rdo","obra360","dre","procurement","measurements","documents","universidade","ai"]','["desktop","mobile"]',60,30,15,1,CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO app_schema_meta(key,value,updated_at) VALUES ('schema_version','5',CURRENT_TIMESTAMP);
