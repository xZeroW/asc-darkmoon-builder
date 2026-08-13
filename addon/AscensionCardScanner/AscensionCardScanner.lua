local addonName = ...

AscensionCardScannerDB = AscensionCardScannerDB or {}
AscensionCardScannerDB.runs = AscensionCardScannerDB.runs or {}

local function isInterestingName(name)
    if type(name) ~= "string" then
        return false
    end

    name = string.lower(name)
    return string.find(name, "skill", 1, true)
        or string.find(name, "card", 1, true)
        or string.find(name, "talent", 1, true)
        or string.find(name, "ability", 1, true)
        or string.find(name, "wildcard", 1, true)
end

local function safeValue(value)
    local valueType = type(value)
    if valueType == "string" or valueType == "number" or valueType == "boolean" then
        return value
    end
    return nil
end

local function frameText(frame)
    if not frame or not frame.GetText then
        return nil
    end
    return safeValue(frame:GetText())
end

local function collectObjectFields(object, depth, seen)
    if type(object) ~= "table" or depth < 0 then
        return nil
    end
    seen = seen or {}
    if seen[object] then
        return "<cycle>"
    end
    seen[object] = true

    local result = {}
    for key, value in pairs(object) do
        local valueType = type(value)
        if valueType == "string" or valueType == "number" or valueType == "boolean" then
            result[tostring(key)] = value
        elseif valueType == "table" and depth > 0 then
            local child = collectObjectFields(value, depth - 1, seen)
            if child then
                result[tostring(key)] = child
            end
        end
    end
    return result
end

local function collectFrameObject(name, depth)
    local frame = _G[name]
    if not frame then
        return nil
    end
    local result = collectObjectFields(frame, depth)
    result.name = name
    result.objectType = frame.GetObjectType and frame:GetObjectType() or nil
    result.text = frameText(frame)
    if frame.GetAttribute then
        result.attributes = {}
        for _, attribute in ipairs({"id", "spell", "spellID", "entry", "item", "itemID", "data", "index"}) do
            local value = safeValue(frame:GetAttribute(attribute))
            if value ~= nil then
                result.attributes[attribute] = value
            end
        end
    end
    return result
end

local function collectGlobals()
    local result = {}
    for name, value in pairs(_G) do
        if isInterestingName(name) then
            local simpleValue = safeValue(value)
            if simpleValue ~= nil then
                result[name] = simpleValue
            elseif type(value) == "table" then
                result[name] = {
                    type = "table",
                    keys = 0,
                }
                for _ in pairs(value) do
                    result[name].keys = result[name].keys + 1
                end
            elseif type(value) == "function" then
                result[name] = "function"
            end
        end
    end
    return result
end

local function regionText(region)
    if not region or not region.GetText then
        return nil
    end
    return safeValue(region:GetText())
end

local function clickAllFilters()
    local clicked = {}
    local frame = EnumerateFrames()
    while frame do
        local text = frameText(frame)
        local lowerText = type(text) == "string" and string.lower(text) or ""
        if frame.IsShown and frame:IsShown()
            and frame.GetObjectType and frame:GetObjectType() == "Button"
            and (lowerText == "all" or lowerText == "show all" or lowerText == "reset")
            and frame.Click then
            frame:Click()
            clicked[#clicked + 1] = {
                name = frame.GetName and frame:GetName() or nil,
                text = text,
            }
        end
        frame = EnumerateFrames(frame)
    end
    return clicked
end

local function collectFrames()
    local result = {}
    local frame = EnumerateFrames()
    while frame do
        local name = frame.GetName and frame:GetName() or nil
        local text = frameText(frame)
        if isInterestingName(name) or isInterestingName(text) then
            local item = {
                name = name,
                type = frame.GetObjectType and frame:GetObjectType() or nil,
                text = text,
                shown = frame.IsShown and frame:IsShown() or nil,
                children = frame.GetNumChildren and frame:GetNumChildren() or nil,
                regions = frame.GetNumRegions and frame:GetNumRegions() or nil,
            }
            if frame.GetRegions then
                item.regionText = {}
                for index = 1, frame:GetNumRegions() do
                    local region = select(index, frame:GetRegions())
                    local value = regionText(region)
                    if value then
                        item.regionText[#item.regionText + 1] = value
                    end
                end
            end
            result[#result + 1] = item
        end
        frame = EnumerateFrames(frame)
    end
    return result
end

local function collectSkillCardAPI()
    local names = {
        "GetNumCharacterAdvancements",
        "GetCharacterAdvancementInfo",
        "GetNumSkillCards",
        "GetSkillCardInfo",
        "GetNumWildcardEntries",
        "GetWildcardEntryInfo",
        "GetNumAbilities",
        "GetAbilityInfo",
        "GetNumTalents",
        "GetTalentInfo",
    }
    local result = {}
    for _, name in ipairs(names) do
        local value = _G[name]
        if value ~= nil then
            result[name] = type(value)
        end
    end
    return result
end

local function collectSkillCardObjects()
    local result = {}
    for _, name in ipairs({
        "SkillCardsFrame",
        "SkillCardsUI",
        "SkillCardsFrameMixin",
        "SkillCardsScrollMixin",
        "SkillCardsScrollItemMixin",
        "SkillCardsFrameFilterMenu",
    }) do
        local object = collectFrameObject(name, 2)
        if object then
            result[name] = object
        end
    end

    for _, listName in ipairs({"Normal", "Golden"}) do
        for index = 1, 100 do
            local name = "SkillCardsFrame.ScrollList" .. listName .. "ScrollFrameButton" .. index
            local object = collectFrameObject(name, 2)
            if object then
                result[name] = object
            end
        end
    end
    return result
end

local function scanTabs()
    local tabs = {}
    for index = 1, 4 do
        local tab = _G["SkillCardsFrameTab" .. index]
        if tab and tab.Click then
            tab:Click()
            tabs[index] = {
                name = tab:GetText(),
                objects = collectSkillCardObjects(),
                frames = collectFrames(),
            }
        end
    end
    return tabs
end

local function getList(tabIndex, golden)
    local tab = _G["SkillCardsFrameTab" .. tabIndex]
    if not tab then
        return nil
    end
    tab:Click()
    local listName = golden and "Golden" or "Normal"
    return SkillCardsFrame["ScrollList" .. listName]
end

local function clearSkillCardFilter()
    local button = _G["SkillCardsFrameFilterClearButton"]
    if button and button.Click then
        button:Click()
        return true
    end
    return false
end

local function collectVisibleRows(list, tabIndex, result)
    local listName = "Normal"
    for index = 1, 40 do
        local button = _G["SkillCardsFrame.ScrollList" .. listName .. "ScrollFrameButton" .. index]
        if button and button:IsShown() and button.cardID and button.spellID then
            result[button.cardID] = {
                cardID = button.cardID,
                spellID = button.spellID,
                tab = tabIndex,
                listIndex = button.index,
            }
        end
    end
end

local function countFilteredRows(list)
    local count = 0
    for _ in pairs(list.filteredIndices or {}) do
        count = count + 1
    end
    return count
end

local function inspectListData(list)
    local inspection = {
        fields = {},
        filteredIndices = {},
        recordTables = {},
    }
    for index in pairs(list.filteredIndices or {}) do
        inspection.filteredIndices[#inspection.filteredIndices + 1] = index
    end
    table.sort(inspection.filteredIndices)

    for key, value in pairs(list) do
        local valueType = type(value)
        if valueType ~= "table" then
            inspection.fields[tostring(key)] = valueType
        else
            local tableInfo = {
                count = 0,
                sample = {},
            }
            for entryKey, entryValue in pairs(value) do
                tableInfo.count = tableInfo.count + 1
                if #tableInfo.sample < 3 and type(entryValue) == "table" then
                    local record = {}
                    for recordKey, recordValue in pairs(entryValue) do
                        if type(recordValue) == "string" or type(recordValue) == "number" or type(recordValue) == "boolean" then
                            record[tostring(recordKey)] = recordValue
                        end
                    end
                    if next(record) then
                        record.key = entryKey
                        tableInfo.sample[#tableInfo.sample + 1] = record
                    end
                end
            end
            inspection.recordTables[tostring(key)] = tableInfo
        end
    end
    return inspection
end

local function collectListItems(list)
    local items = {}
    if not list.GetItemData then
        return items
    end

    for visibleIndex, sourceIndex in ipairs(list.filteredIndices or {}) do
        local ok, item = pcall(list.GetItemData, list, visibleIndex)
        if not ok or type(item) ~= "table" then
            ok, item = pcall(list.GetItemData, list, sourceIndex)
        end
        if ok and type(item) == "table" then
            local record = collectObjectFields(item, 1) or {}
            local name, rank, icon = GetSpellInfo(item.SpellID)
            record.name = name
            record.rankText = rank
            record.icon = icon
            record.visibleIndex = visibleIndex
            record.sourceIndex = sourceIndex
            items[#items + 1] = record
        end
    end
    return items
end

local exportFrame = CreateFrame("Frame")
local exportState

local function finishExport()
    local cards = {}
    for _, card in pairs(exportState.cards) do
        cards[#cards + 1] = card
    end
    table.sort(cards, function(left, right)
        return left.cardID < right.cardID
    end)
    AscensionCardScannerDB.export = {
        timestamp = time(),
        realm = GetRealmName and GetRealmName() or nil,
        character = UnitName and UnitName("player") or nil,
        filterCleared = exportState.filterCleared,
        totalRows = exportState.totalRows,
        cards = cards,
        pools = exportState.pools,
    }
    exportFrame:SetScript("OnUpdate", nil)
    print("AscensionCardScanner: clear filter clicked: " .. tostring(exportState.filterCleared))
    print("AscensionCardScanner: captured " .. #cards .. " cards from " .. exportState.totalRows .. " list rows")
    print("AscensionCardScanner: saved internal pool data for " .. #exportState.pools .. " tabs")
    print("AscensionCardScanner: run /reload when you are ready to save the export")
    exportState = nil
end

local function exportStep()
    local state = exportState
    if not state then
        return
    end

    if state.waitFrames and state.waitFrames > 0 then
        state.waitFrames = state.waitFrames - 1
        return
    end

    if state.listIndex > #state.lists then
        finishExport()
        return
    end

    local current = state.lists[state.listIndex]
    if not current.started then
        current.started = true
        current.listTab:Click()
        current.filterCleared = clearSkillCardFilter()
        state.filterCleared = state.filterCleared and current.filterCleared
        current.waitFrames = 5
        return
    end

    if current.waitFrames and current.waitFrames > 0 then
        current.waitFrames = current.waitFrames - 1
        return
    end

    if current.collectAfterRefresh then
        collectVisibleRows(current.list, current.tabIndex, state.cards)
        current.offset = current.offset + 8
        current.collectAfterRefresh = nil
        return
    end

    if not current.list then
        current.list = SkillCardsFrame.ScrollListNormal
        if not current.list then
            state.listIndex = state.listIndex + 1
            return
        end
        current.count = countFilteredRows(current.list)
        state.totalRows = state.totalRows + current.count
        state.pools[#state.pools + 1] = {
            tab = current.tabIndex,
            filteredRows = current.count,
            data = inspectListData(current.list),
            items = collectListItems(current.list),
        }
    end

    if current.offset > math.max(current.count - 8, 0) then
        state.listIndex = state.listIndex + 1
        return
    end

    local scrollFrame = current.list.ScrollFrame
    if scrollFrame then
        if HybridScrollFrame_SetOffset then
            HybridScrollFrame_SetOffset(scrollFrame, current.offset)
        end
        if scrollFrame.SetVerticalScroll then
            scrollFrame:SetVerticalScroll(current.offset * 46)
        end
    end
    if current.list.RefreshScrollFrame then
        current.list:RefreshScrollFrame()
    end
    current.waitFrames = 3
    current.collectAfterRefresh = true
    return
end

local function startExport()
    exportState = {
        cards = {},
        filterCleared = true,
        listIndex = 1,
        totalRows = 0,
        lists = {},
        pools = {},
        waitFrames = 3,
    }
    for tabIndex = 1, 4 do
        exportState.lists[#exportState.lists + 1] = {
            tabIndex = tabIndex,
            listTab = _G["SkillCardsFrameTab" .. tabIndex],
            offset = 0,
        }
    end
    exportFrame:SetScript("OnUpdate", function()
        exportStep()
    end)
    print("AscensionCardScanner: export started; scan will run over several frames")
end

local function scan(clicked)
    local run = {
        timestamp = time(),
        realm = GetRealmName and GetRealmName() or nil,
        character = UnitName and UnitName("player") or nil,
        clickedFilters = clicked or {},
        globals = collectGlobals(),
        api = collectSkillCardAPI(),
        objects = collectSkillCardObjects(),
        frames = collectFrames(),
    }
    AscensionCardScannerDB.runs[#AscensionCardScannerDB.runs + 1] = run
    print("AscensionCardScanner: saved diagnostic scan " .. #AscensionCardScannerDB.runs)
    print("AscensionCardScanner: run /reload or log out cleanly to write SavedVariables")
end

local function dumpTable(value, indent, seen)
    indent = indent or ""
    seen = seen or {}
    if type(value) ~= "table" then
        return tostring(value)
    end
    if seen[value] then
        return "<cycle>"
    end
    seen[value] = true
    local lines = {"{"}
    for key, child in pairs(value) do
        local keyText = tostring(key)
        lines[#lines + 1] = indent .. "  [" .. keyText .. "] = " .. dumpTable(child, indent .. "  ", seen) .. ","
    end
    lines[#lines + 1] = indent .. "}"
    return table.concat(lines, "\n")
end

SLASH_ASCENSIONCARDSCANNER1 = "/ascscan"
SlashCmdList.ASCENSIONCARDSCANNER = function()
    scan()
end

SLASH_ASCENSIONCARDSCANNERALL1 = "/ascall"
SlashCmdList.ASCENSIONCARDSCANNERALL = function()
    local clicked = clickAllFilters()
    scan(clicked)
    print("AscensionCardScanner: clicked " .. #clicked .. " possible all/reset filters")
end

SLASH_ASCENSIONCARDSCANNERTABS1 = "/asctabs"
SlashCmdList.ASCENSIONCARDSCANNERTABS = function()
    local run = {
        timestamp = time(),
        realm = GetRealmName and GetRealmName() or nil,
        character = UnitName and UnitName("player") or nil,
        tabs = scanTabs(),
    }
    AscensionCardScannerDB.tabRuns = AscensionCardScannerDB.tabRuns or {}
    AscensionCardScannerDB.tabRuns[#AscensionCardScannerDB.tabRuns + 1] = run
    print("AscensionCardScanner: saved all Skill Cards tabs scan " .. #AscensionCardScannerDB.tabRuns)
    print("AscensionCardScanner: run /reload or log out cleanly to write SavedVariables")
end

SLASH_ASCENSIONCARDSCANNEREXPORT1 = "/ascexport"
SlashCmdList.ASCENSIONCARDSCANNEREXPORT = function()
    if exportState then
        print("AscensionCardScanner: export already running")
        return
    end
    startExport()
end

SLASH_ASCENSIONCARDSCANNERDUMP1 = "/ascdump"
SlashCmdList.ASCENSIONCARDSCANNERDUMP = function()
    local latest = AscensionCardScannerDB.runs[#AscensionCardScannerDB.runs]
    if not latest then
        print("AscensionCardScanner: no scan yet; use /ascscan")
        return
    end
    print(dumpTable(latest))
end

local eventFrame = CreateFrame("Frame")
eventFrame:RegisterEvent("PLAYER_LOGIN")
eventFrame:SetScript("OnEvent", function()
    print("AscensionCardScanner loaded. Open Skill Cards and use /ascscan.")
end)
