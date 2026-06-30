-- 09_advanced_stock_pim.sql
-- Modernização do PIM (Product Information Management) e Sistema de Stock Multi-Armazém (Odoo Style)

-- 1. Criação da tabela de Armazéns (Warehouses)
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Modificação da tabela Products para suportar PIM (Imagem, UoM)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS base_uom TEXT DEFAULT 'un' NOT NULL, -- Unidade de Medida Base (ex: un, kg, cx)
ADD COLUMN IF NOT EXISTS purchase_uom TEXT, -- Unidade de Medida de Compra
ADD COLUMN IF NOT EXISTS purchase_uom_factor NUMERIC DEFAULT 1, -- Quantidade de Base_UoM por Purchase_UoM (ex: 1 caixa = 24 un)
ADD COLUMN IF NOT EXISTS barcode TEXT; -- Código de barras global do produto

-- 3. Criação da tabela de Variantes de Produto (Product Variants)
-- Exemplo: Produto "T-Shirt", Variante 1: "Tamanho S, Cor Azul"
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Ex: "S - Azul"
    sku TEXT,
    barcode TEXT,
    price_adjustment NUMERIC DEFAULT 0, -- Se a variante for mais cara/barata que o preço base
    cost_price NUMERIC DEFAULT 0, -- Preço de custo médio desta variante específica
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Criação da tabela de Stock por Armazém (Product Stocks)
-- Substitui a coluna `quantity_in_stock` global pela gestão localizada
CREATE TABLE IF NOT EXISTS public.product_stocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE, -- Null se não tiver variantes
    warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0 NOT NULL,
    min_stock NUMERIC DEFAULT 0, -- Alerta de reposição
    max_stock NUMERIC,
    reserved_quantity NUMERIC DEFAULT 0, -- Stock Cativo (em pró-formas, encomendas)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, variant_id, warehouse_id) -- Impede duplicados no mesmo armazém
);

-- 5. Atualização da tabela Stock Movements para suportar transferências e rastreio de custo
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS source_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0; -- Qual era o preço de custo no momento da movimentação

-- 6. Trigger para gerir updated_at nas tabelas novas
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER set_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_product_stocks_updated_at ON public.product_stocks;
CREATE TRIGGER set_product_stocks_updated_at
BEFORE UPDATE ON public.product_stocks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Criar Armazém Principal para empresas existentes automaticamente (Migração de dados)
DO $$
DECLARE
    comp RECORD;
    main_warehouse_id UUID;
    prod RECORD;
BEGIN
    FOR comp IN SELECT id FROM public.companies LOOP
        -- Verificar se a empresa já tem um armazém principal
        IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE company_id = comp.id AND is_default = true) THEN
            -- Criar Armazém Principal
            INSERT INTO public.warehouses (company_id, name, is_default)
            VALUES (comp.id, 'Armazém Principal', true)
            RETURNING id INTO main_warehouse_id;

            -- Mover o stock global antigo para a nova tabela de stock do armazém principal
            FOR prod IN SELECT id, quantity_in_stock, stock_alert_threshold FROM public.products WHERE company_id = comp.id LOOP
                INSERT INTO public.product_stocks (company_id, product_id, warehouse_id, quantity, min_stock)
                VALUES (comp.id, prod.id, main_warehouse_id, COALESCE(prod.quantity_in_stock, 0), COALESCE(prod.stock_alert_threshold, 0))
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;
END;
$$;
