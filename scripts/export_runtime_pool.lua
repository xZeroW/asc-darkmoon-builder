-- Converts the AscensionCardScanner SavedVariables export into JSON.
-- Run with: luajit scripts/export_runtime_pool.lua <scanner.lua> <output.json>

local inputPath = assert(arg[1], "Missing scanner SavedVariables path")
local outputPath = assert(arg[2], "Missing output JSON path")

dofile(inputPath)

local export = assert(AscensionCardScannerDB and AscensionCardScannerDB.export, "No scanner export found")
local categoryByTab = {
    [1] = "ability",
    [2] = "starter_skill",
    [3] = "lucky",
    [4] = "talent",
}

local function escapeString(value)
    return value:gsub("[\\\"\b\f\n\r\t]", {
        ["\\"] = "\\\\",
        ["\""] = "\\\"",
        ["\b"] = "\\b",
        ["\f"] = "\\f",
        ["\n"] = "\\n",
        ["\r"] = "\\r",
        ["\t"] = "\\t",
    })
end

local function encode(value)
    if value == nil then
        return "null"
    end
    if type(value) == "boolean" then
        return value and "true" or "false"
    end
    if type(value) == "number" then
        return tostring(value)
    end
    if type(value) == "string" then
        return "\"" .. escapeString(value) .. "\""
    end
    error("Unsupported JSON value: " .. type(value))
end

local rows = {}
for _, pool in ipairs(export.pools or {}) do
    for _, item in ipairs(pool.items or {}) do
        rows[#rows + 1] = {
            category = categoryByTab[pool.tab] or "unknown",
            cardId = item.CardID,
            itemId = item.ItemID,
            spellId = item.SpellID,
            name = item.name,
            rank = item.Rank,
            maxRank = item.MaxRank,
            quality = item.Quality,
            qualityCost = item.QualityCost,
            type = item.Type,
            class = item.Class,
            expansion = item.Expansion,
            isStarterCard = item.IsStarterCard,
            isWildcard = item.IsWildcard,
            isDraftMode = item.IsDraftMode,
            icon = item.icon,
        }
    end
end

table.sort(rows, function(left, right)
    if left.category == right.category then
        if left.name == right.name then
            return left.spellId < right.spellId
        end
        return left.name < right.name
    end
    return left.category < right.category
end)

local file = assert(io.open(outputPath, "w"))
file:write("{\n  \"schemaVersion\": 1,\n")
file:write("  \"source\": {\"realm\": ", encode(export.realm), ", \"character\": ", encode(export.character), "},\n")
file:write("  \"records\": [\n")
for index, row in ipairs(rows) do
    file:write("    {")
    local fields = {}
    for key, value in pairs(row) do
        fields[#fields + 1] = key
    end
    table.sort(fields)
    for fieldIndex, key in ipairs(fields) do
        file:write("\"", key, "\": ", encode(row[key]))
        if fieldIndex < #fields then
            file:write(", ")
        end
    end
    file:write("}")
    if index < #rows then
        file:write(",")
    end
    file:write("\n")
end
file:write("  ]\n}\n")
file:close()

print("Exported " .. #rows .. " runtime card records to " .. outputPath)
