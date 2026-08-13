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
    if type(value) == "table" then
        local isArray = #value > 0
        local parts = {}
        if isArray then
            for index, item in ipairs(value) do
                parts[#parts + 1] = encode(item)
            end
            return "[" .. table.concat(parts, ", ") .. "]"
        end
        local keys = {}
        for key in pairs(value) do
            keys[#keys + 1] = key
        end
        table.sort(keys)
        for _, key in ipairs(keys) do
            parts[#parts + 1] = encode(tostring(key)) .. ": " .. encode(value[key])
        end
        return "{" .. table.concat(parts, ", ") .. "}"
    end
    error("Unsupported JSON value: " .. type(value))
end

local function cleanDescription(value)
    if type(value) ~= "string" then
        return nil
    end
    value = value:gsub("|c%x%x%x%x%x%x%x%x", "")
    value = value:gsub("|r", "")
    value = value:gsub("|T.-|t", "")
    value = value:gsub("%s*Hold SHIFT for more information%s*", "")
    value = value:gsub("\r\n", "\n")
    value = value:gsub("^%s+", ""):gsub("%s+$", "")
    return value ~= "" and value or nil
end

local function cleanTooltipLines(lines)
    if type(lines) ~= "table" then
        return nil
    end
    local result = {}
    for _, line in ipairs(lines) do
        local left = cleanDescription(line.left)
        local right = cleanDescription(line.right)
        if left or right then
            result[#result + 1] = { left = left, right = right }
        end
    end
    return #result > 0 and result or nil
end

local function getTooltipLevel(lines)
    if type(lines) ~= "table" then
        return nil
    end
    for _, line in ipairs(lines) do
        for _, value in ipairs({ line.left, line.right }) do
            if type(value) == "string" then
                local level = value:match("^[Ll]evel:%s*(%d+)$")
                    or value:match("^[Ll]evel%s+(%d+)$")
                if level then
                    return tonumber(level)
                end
            end
        end
    end
    return nil
end

local rows = {}
for _, pool in ipairs(export.pools or {}) do
    for _, item in ipairs(pool.items or {}) do
        local iconUrl
        local tooltipLines = cleanTooltipLines(item.tooltipLines)
        if type(item.icon) == "string" then
            iconUrl = "icons/" .. string.lower(item.icon):gsub("\\", "-") .. ".webp"
        end
        rows[#rows + 1] = {
            category = categoryByTab[pool.tab] or "unknown",
            cardId = item.CardID,
            itemId = item.ItemID,
            spellId = item.SpellID,
            name = item.name,
            description = cleanDescription(item.description),
            tooltipLines = tooltipLines,
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
            iconUrl = iconUrl,
            requiredLevel = getTooltipLevel(tooltipLines) or item.requiredLevel,
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
